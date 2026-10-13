import { Router } from 'express';
import { z } from 'zod';
import { AccountModel } from '../models/Account.js';
import { BudgetModel } from '../models/Budget.js';
import { CategoryModel } from '../models/Category.js';
import { DebtModel } from '../models/Debt.js';
import { TransactionModel } from '../models/Transaction.js';
import { accountBalance, budgetUsage, dayEnd, dayStart, debtOutstanding, objectId } from '../utils/mongoFinance.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();
const periodSchema = z.object({
  period: z.enum(['month', '3months', '6months', 'year']).default('month'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const vietnamToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const dateWindow = (period: 'month' | '3months' | '6months' | 'year', startDate?: string, endDate?: string) => {
  if (startDate || endDate) {
    if (!startDate || !endDate || Number.isNaN(Date.parse(startDate)) || Number.isNaN(Date.parse(endDate)) || startDate > endDate) return null;
    return { start: dayStart(startDate), end: dayEnd(endDate) };
  }
  const [year, month, day] = vietnamToday().split('-').map(Number);
  const monthsBack = period === '3months' ? 2 : period === '6months' ? 5 : 0;
  const start = period === 'year' ? `${year}-01-01` : `${new Date(Date.UTC(year, month - 1 - monthsBack, 1)).toISOString().slice(0, 7)}-01`;
  const end = period === 'month' ? vietnamToday() : `${year}-${String(month).padStart(2, '0')}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')}`;
  return { start: dayStart(start), end: dayEnd(end) };
};

const accountBalances = async (userId: string) => {
  const accounts = await AccountModel.find({ userId, isArchived: false }).sort({ createdAt: 1 });
  return Promise.all(accounts.map(async (account) => ({
    ...account.toJSON(),
    currentBalance: await accountBalance(userId, account._id, account.openingBalance),
  })));
};

const budgetWarnings = async (userId: string) => {
  const budgets = await BudgetModel.find({ userId });
  const categories = await CategoryModel.find({ _id: { $in: budgets.map((item) => item.categoryId) } }).select('name').lean();
  const names = new Map(categories.map((category) => [String(category._id), category.name]));
  const results = await Promise.all(budgets.map(async (budget) => ({
    ...budget.toJSON(),
    categoryName: names.get(budget.categoryId.toString()) ?? 'Archived category',
    ...await budgetUsage(userId, budget.categoryId, budget.periodStart, budget.periodEnd, budget.amountLimit),
  })));
  return results.filter((budget) => budget.usagePercentage >= 80);
};

const debtWarnings = async (userId: string) => {
  const today = vietnamToday();
  const cutoff = dayEnd(new Date(Date.parse(`${today}T00:00:00+07:00`) + 7 * 86_400_000).toISOString());
  const debts = await DebtModel.find({ userId, dueDate: { $lte: cutoff } }).sort({ dueDate: 1 });
  const results = await Promise.all(debts.map(async (debt) => ({
    ...debt.toJSON(),
    outstandingAmount: await debtOutstanding(userId, debt._id, debt.principalAmount),
  })));
  return results.filter((debt) => debt.outstandingAmount > 0);
};

router.get('/summary', requireAuth, async (req: AuthRequest, res, next) => {
  const parsed = periodSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid dashboard period.' });
  const window = dateWindow(parsed.data.period, parsed.data.startDate, parsed.data.endDate);
  if (!window) return res.status(400).json({ success: false, message: 'Provide a valid startDate and endDate range.' });
  try {
    const match = { userId: objectId(req.user!.id), transactionDate: { $gte: window.start, $lte: window.end } };
    const [totals, balances, budgets, debts, transactionCount] = await Promise.all([
      TransactionModel.aggregate<{ _id: string; total: number }>([
        { $match: match },
        { $match: { type: { $in: ['INCOME', 'EXPENSE'] } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]),
      accountBalances(req.user!.id),
      budgetWarnings(req.user!.id),
      debtWarnings(req.user!.id),
      TransactionModel.countDocuments(match),
    ]);
    const totalsMap = new Map(totals.map((item) => [item._id, item.total]));
    return res.json({
      success: true,
      data: {
        totalIncome: totalsMap.get('INCOME') ?? 0,
        totalExpenses: totalsMap.get('EXPENSE') ?? 0,
        currentBalance: balances.reduce((sum, item) => sum + item.currentBalance, 0),
        accountCount: balances.length,
        transactionCount,
        budgetWarnings: budgets,
        debtWarnings: debts,
        period: { startDate: window.start.toISOString(), endDate: window.end.toISOString() },
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/charts', requireAuth, async (req: AuthRequest, res, next) => {
  const parsed = z.object({ months: z.coerce.number().int().min(1).max(12).default(6) }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'months must be between 1 and 12.' });
  try {
    const [currentYear, currentMonth] = vietnamToday().split('-').map(Number);
    const months = Array.from({ length: parsed.data.months }, (_, index) => {
      const date = new Date(Date.UTC(currentYear, currentMonth - parsed.data.months + index, 1));
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
    });
    const start = `${months[0].year}-${String(months[0].month).padStart(2, '0')}-01`;
    const currentKey = `${months[months.length - 1].year}-${String(months[months.length - 1].month).padStart(2, '0')}`;
    const endDay = new Date(Date.UTC(months[months.length - 1].year, months[months.length - 1].month, 0)).getUTCDate();
    const end = `${currentKey}-${String(endDay).padStart(2, '0')}`;
    const transactions = await TransactionModel.find({
      userId: req.user!.id,
      transactionDate: { $gte: dayStart(start), $lte: dayEnd(end) },
      type: { $in: ['INCOME', 'EXPENSE'] },
    }).select('type amount categoryId transactionDate').lean();
    const incomeTrend = months.map(({ year, month }) => {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const items = transactions.filter((item) => {
        const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).format(item.transactionDate);
        return date === key;
      });
      return {
        name: new Intl.DateTimeFormat('vi-VN', { month: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(dayStart(`${key}-01`)),
        income: items.filter((item) => item.type === 'INCOME').reduce((sum, item) => sum + item.amount, 0),
        expense: items.filter((item) => item.type === 'EXPENSE').reduce((sum, item) => sum + item.amount, 0),
      };
    });
    const expenseByCategory = new Map<string, number>();
    for (const item of transactions) {
      if (item.type === 'EXPENSE' && item.categoryId) {
        const key = item.categoryId.toString();
        expenseByCategory.set(key, (expenseByCategory.get(key) ?? 0) + item.amount);
      }
    }
    const categoryIds = [...expenseByCategory.keys()].map(objectId).filter((id) => id !== null);
    const categories = await CategoryModel.find({
      _id: { $in: categoryIds },
      isArchived: false,
      $or: [{ isSystem: true, userId: null }, { isSystem: false, userId: req.user!.id }],
    }).select('name').lean();
    const names = new Map(categories.map((item) => [String(item._id), item.name]));
    const categoryExpense = [...expenseByCategory].map(([id, value]) => ({ name: names.get(id) ?? 'Archived category', value }));
    return res.json({ success: true, data: { incomeTrend, categoryExpense } });
  } catch (error) {
    return next(error);
  }
});

router.get('/recent-transactions', requireAuth, async (req: AuthRequest, res, next) => {
  const parsed = z.object({ limit: z.coerce.number().int().min(1).max(20).default(5) }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'limit must be between 1 and 20.' });
  try {
    const transactions = await TransactionModel.find({ userId: req.user!.id }).sort({ transactionDate: -1 }).limit(parsed.data.limit);
    return res.json({ success: true, data: transactions });
  } catch (error) {
    return next(error);
  }
});

export default router;
