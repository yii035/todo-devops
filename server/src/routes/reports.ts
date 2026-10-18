import { Router } from 'express';
import { z } from 'zod';
import { AccountModel } from '../models/Account.js';
import { CategoryModel } from '../models/Category.js';
import { TransactionModel } from '../models/Transaction.js';
import { accountBalance, dayEnd, dayStart, objectId } from '../utils/mongoFinance.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();
const filterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
});

const reportFilter = (req: AuthRequest) => {
  const parsed = filterSchema.safeParse(req.query);
  if (!parsed.success) return { error: 'Invalid report filters.' as const };
  const filters = parsed.data;
  if (filters.startDate && Number.isNaN(Date.parse(filters.startDate))) return { error: 'Invalid startDate.' as const };
  if (filters.endDate && Number.isNaN(Date.parse(filters.endDate))) return { error: 'Invalid endDate.' as const };
  if (filters.startDate && filters.endDate && filters.startDate.slice(0, 10) > filters.endDate.slice(0, 10)) {
    return { error: 'startDate must not follow endDate.' as const };
  }
  const query: Record<string, unknown> = { userId: objectId(req.user!.id) };
  if (filters.type) query.type = filters.type;
  if (filters.categoryId) query.categoryId = objectId(filters.categoryId) ?? null;
  if (filters.accountId) {
    const accountId = objectId(filters.accountId);
    query.$or = accountId ? [{ accountId }, { destinationAccountId: accountId }] : [{ _id: null }];
  }
  if (filters.startDate || filters.endDate) {
    query.transactionDate = {
      ...(filters.startDate ? { $gte: dayStart(filters.startDate) } : {}),
      ...(filters.endDate ? { $lte: dayEnd(filters.endDate) } : {}),
    };
  }
  return { query };
};

router.get('/summary', requireAuth, async (req: AuthRequest, res, next) => {
  const result = reportFilter(req);
  if ('error' in result) return res.status(400).json({ success: false, message: result.error });
  try {
    const [totals, accounts, transactionCount] = await Promise.all([
      TransactionModel.aggregate<{ _id: string; total: number }>([
        { $match: result.query },
        { $match: { type: { $in: ['INCOME', 'EXPENSE'] } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]),
      AccountModel.find({ userId: req.user!.id, isArchived: false }),
      TransactionModel.countDocuments(result.query),
    ]);
    const totalByType = new Map(totals.map((item) => [item._id, item.total]));
    const accountBalances = await Promise.all(accounts.map(async (account) => ({
      accountId: account._id,
      name: account.name,
      currency: account.currency,
      balance: await accountBalance(req.user!.id, account._id, account.openingBalance),
    })));
    return res.json({
      success: true,
      data: {
        totalIncome: totalByType.get('INCOME') ?? 0,
        totalExpense: totalByType.get('EXPENSE') ?? 0,
        balance: accountBalances.reduce((sum, item) => sum + item.balance, 0),
        transactionCount,
        accountBalances,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/income-expense', requireAuth, async (req: AuthRequest, res, next) => {
  const result = reportFilter(req);
  if ('error' in result) return res.status(400).json({ success: false, message: result.error });
  try {
    const rows = await TransactionModel.aggregate([
      { $match: { ...result.query, type: { $in: ['INCOME', 'EXPENSE'] } } },
      {
        $group: {
          _id: {
            year: { $year: { date: '$transactionDate', timezone: 'Asia/Ho_Chi_Minh' } },
            month: { $month: { date: '$transactionDate', timezone: 'Asia/Ho_Chi_Minh' } },
            type: '$type',
          },
          total: { $sum: '$amount' },
        },
      },
    ]);
    const monthly = new Map<string, { month: string; income: number; expense: number }>();
    for (const row of rows) {
      const key = `${row._id.year}-${String(row._id.month).padStart(2, '0')}`;
      const item = monthly.get(key) ?? { month: key, income: 0, expense: 0 };
      item[row._id.type === 'INCOME' ? 'income' : 'expense'] = row.total;
      monthly.set(key, item);
    }
    return res.json({ success: true, data: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)) });
  } catch (error) {
    return next(error);
  }
});

router.get('/category-expenses', requireAuth, async (req: AuthRequest, res, next) => {
  const result = reportFilter(req);
  if ('error' in result) return res.status(400).json({ success: false, message: result.error });
  try {
    const rows = await TransactionModel.aggregate([
      { $match: { ...result.query, type: 'EXPENSE', categoryId: { $ne: null } } },
      { $group: { _id: '$categoryId', amount: { $sum: '$amount' } } },
      { $sort: { amount: -1 } },
    ]);
    const categories = await CategoryModel.find({
      _id: { $in: rows.map((item) => item._id) },
      $or: [{ isSystem: true, userId: null }, { isSystem: false, userId: req.user!.id }],
    }).select('name').lean();
    const names = new Map(categories.map((item) => [String(item._id), item.name]));
    return res.json({ success: true, data: rows.map((item) => ({
      categoryId: item._id,
      name: names.get(item._id.toString()) ?? 'Archived category',
      amount: item.amount,
    })) });
  } catch (error) {
    return next(error);
  }
});

router.get('/export', requireAuth, async (req: AuthRequest, res, next) => {
  const result = reportFilter(req);
  if ('error' in result) return res.status(400).json({ success: false, message: result.error });
  try {
    const transactions = await TransactionModel.find(result.query).sort({ transactionDate: -1 }).limit(10000).lean();
    const accountIds = [...new Set(transactions.flatMap((item) => [item.accountId?.toString(), item.destinationAccountId?.toString()].filter(Boolean)))];
    const categoryIds = [...new Set(transactions.map((item) => item.categoryId?.toString()).filter(Boolean))];
    const [accounts, categories] = await Promise.all([
      AccountModel.find({ _id: { $in: accountIds }, userId: req.user!.id }).select('name').lean(),
      CategoryModel.find({ _id: { $in: categoryIds }, $or: [{ isSystem: true, userId: null }, { isSystem: false, userId: req.user!.id }] }).select('name').lean(),
    ]);
    const accountNames = new Map(accounts.map((item) => [String(item._id), item.name]));
    const categoryNames = new Map(categories.map((item) => [String(item._id), item.name]));
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const delimiter = ';';
    const csv = [
      ['Title', 'Type', 'Amount', 'Category', 'Account', 'Date', 'Note'].join(delimiter),
      ...transactions.map((item) => [
        item.title, item.type, item.amount,
        item.categoryId ? categoryNames.get(item.categoryId.toString()) ?? '' : '',
        accountNames.get(item.accountId.toString()) ?? '',
        item.transactionDate.toISOString(),
        item.note,
      ].map(escape).join(delimiter)),
    ].join('\r\n');
    res.type('text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="fintrack-report.csv"');
    return res.send(`\uFEFF${csv}`);
  } catch (error) {
    return next(error);
  }
});

export default router;
