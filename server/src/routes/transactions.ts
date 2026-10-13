import mongoose from 'mongoose';
import { Router, type Response } from 'express';
import { z } from 'zod';
import { AccountModel } from '../models/Account.js';
import { CategoryModel } from '../models/Category.js';
import { TransactionModel } from '../models/Transaction.js';
import { dayEnd, dayStart, objectId, userObjectId } from '../utils/mongoFinance.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();
const dateSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date.');
const transactionSchema = z.object({
  title: z.string().trim().min(2).max(120),
  amount: z.number().int().positive().safe(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
  categoryId: z.string().optional(),
  accountId: z.string().min(1),
  destinationAccountId: z.string().optional(),
  transactionDate: dateSchema.optional(),
  note: z.string().max(500).optional(),
}).strict();
const querySchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  sortBy: z.enum(['transactionDate', 'amount', 'title']).default('transactionDate'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const respondInvalid = (res: Response, message: string) => res.status(400).json({ success: false, message });

const referenceError = async (
  userId: string,
  transaction: z.infer<typeof transactionSchema>,
  session?: mongoose.ClientSession,
  allowedArchivedCategoryId?: string,
) => {
  const sourceId = objectId(transaction.accountId);
  if (!sourceId) return 'Invalid source account ID.';
  const source = await AccountModel.findOne({ _id: sourceId, userId, isArchived: false }).session(session ?? null);
  if (!source) return 'Source account not found or archived.';
  if (transaction.type === 'TRANSFER') {
    const destinationId = transaction.destinationAccountId ? objectId(transaction.destinationAccountId) : null;
    if (!destinationId || destinationId.toString() === sourceId.toString()) return 'A transfer requires two different accounts.';
    const destination = await AccountModel.findOne({ _id: destinationId, userId, isArchived: false }).session(session ?? null);
    if (!destination) return 'Destination account not found or archived.';
    if (transaction.categoryId) return 'Transfers cannot have an income or expense category.';
    return null;
  }
  const categoryId = transaction.categoryId ? objectId(transaction.categoryId) : null;
  if (!categoryId) return 'An income or expense transaction requires a valid category.';
  const category = await CategoryModel.findOne({
    _id: categoryId,
    type: transaction.type,
    ...(allowedArchivedCategoryId === categoryId.toString() ? {} : { isArchived: false }),
    $or: [{ isSystem: true, userId: null }, { isSystem: false, userId }],
  }).session(session ?? null);
  if (!category) return 'Category not found, archived, or incompatible with transaction type.';
  if (transaction.destinationAccountId) return 'Only transfers can have a destination account.';
  return null;
};

const buildFilter = (userId: string, filters: z.infer<typeof querySchema>) => {
  const query: Record<string, unknown> = { userId: userObjectId(userId) };
  const clauses: Record<string, unknown>[] = [];
  if (filters.type) query.type = filters.type;
  if (filters.categoryId) {
    const categoryId = objectId(filters.categoryId);
    if (categoryId) query.categoryId = categoryId;
    else query.categoryId = null;
  }
  if (filters.accountId) {
    const accountId = objectId(filters.accountId);
    clauses.push({ $or: accountId ? [{ accountId }, { destinationAccountId: accountId }] : [{ _id: null }] });
  }
  const transactionDate: Record<string, Date> = {};
  if (filters.startDate) transactionDate.$gte = dayStart(filters.startDate);
  if (filters.endDate) transactionDate.$lte = dayEnd(filters.endDate);
  if (Object.keys(transactionDate).length) query.transactionDate = transactionDate;
  if (filters.search?.trim()) {
    const safeSearch = filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    clauses.push({ $or: [{ title: { $regex: safeSearch, $options: 'i' } }, { note: { $regex: safeSearch, $options: 'i' } }] });
  }
  if (clauses.length) query.$and = clauses;
  return query;
};

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return respondInvalid(res, 'Invalid transaction filters.');
  const filters = parsed.data;
  if (filters.startDate && filters.endDate && Date.parse(filters.startDate) > Date.parse(filters.endDate)) {
    return respondInvalid(res, 'startDate must be earlier than or equal to endDate.');
  }
  try {
    const filter = buildFilter(req.user!.id, filters);
    const sort = { [filters.sortBy]: filters.order === 'asc' ? 1 : -1 } as Record<string, 1 | -1>;
    const [data, total] = await Promise.all([
      TransactionModel.find(filter).sort(sort).skip((filters.page - 1) * filters.limit).limit(filters.limit),
      TransactionModel.countDocuments(filter),
    ]);
    return res.json({ success: true, data, meta: { page: filters.page, limit: filters.limit, total, pages: Math.ceil(total / filters.limit) } });
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  const parsed = transactionSchema.safeParse(req.body);
  if (!parsed.success) return respondInvalid(res, 'Invalid transaction payload.');
  const validationError = await referenceError(req.user!.id, parsed.data).catch(next);
  if (validationError === undefined) return;
  if (validationError) return respondInvalid(res, validationError);
  try {
    const [transaction] = await TransactionModel.create([{
      ...parsed.data,
      userId: userObjectId(req.user!.id),
      accountId: objectId(parsed.data.accountId),
      categoryId: parsed.data.categoryId ? objectId(parsed.data.categoryId) : null,
      destinationAccountId: parsed.data.destinationAccountId ? objectId(parsed.data.destinationAccountId) : null,
      transactionDate: parsed.data.transactionDate ? new Date(parsed.data.transactionDate) : new Date(),
    }]);
    return res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    return next(error);
  }
});

router.post('/transfer', requireAuth, async (req: AuthRequest, res, next) => {
  const parsed = transactionSchema.safeParse({ ...req.body, type: 'TRANSFER' });
  if (!parsed.success) return respondInvalid(res, 'Invalid transfer payload.');
  const validationError = await referenceError(req.user!.id, parsed.data).catch(next);
  if (validationError === undefined) return;
  if (validationError) return respondInvalid(res, validationError);
  try {
    const [transaction] = await TransactionModel.create([{
      ...parsed.data,
      userId: userObjectId(req.user!.id),
      accountId: objectId(parsed.data.accountId),
      categoryId: null,
      destinationAccountId: objectId(parsed.data.destinationAccountId!),
      transactionDate: parsed.data.transactionDate ? new Date(parsed.data.transactionDate) : new Date(),
    }]);
    return res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    return next(error);
  }
});

router.get('/export', requireAuth, async (req: AuthRequest, res, next) => {
  const parsed = querySchema.omit({ page: true, limit: true, sortBy: true, order: true }).safeParse(req.query);
  if (!parsed.success) return respondInvalid(res, 'Invalid transaction filters.');
  if (parsed.data.startDate && parsed.data.endDate && Date.parse(parsed.data.startDate) > Date.parse(parsed.data.endDate)) {
    return respondInvalid(res, 'startDate must be earlier than or equal to endDate.');
  }
  try {
    const filter = buildFilter(req.user!.id, { ...parsed.data, page: 1, limit: 100, sortBy: 'transactionDate', order: 'desc' });
    const rows = await TransactionModel.find(filter).sort({ transactionDate: -1 }).limit(10000).lean();
    const accountIds = [...new Set(rows.flatMap((item) => [item.accountId?.toString(), item.destinationAccountId?.toString()].filter(Boolean)))];
    const categoryIds = [...new Set(rows.map((item) => item.categoryId?.toString()).filter(Boolean))];
    const [accounts, categories] = await Promise.all([
      AccountModel.find({ _id: { $in: accountIds }, userId: req.user!.id }).select('name').lean(),
      CategoryModel.find({ _id: { $in: categoryIds } }).select('name userId isSystem').lean(),
    ]);
    const accountNames = new Map(accounts.map((item) => [String(item._id), item.name]));
    const categoryNames = new Map(categories
      .filter((item) => item.isSystem ? item.userId === null : item.userId?.toString() === req.user!.id)
      .map((item) => [String(item._id), item.name]));
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [
      ['Title', 'Type', 'Amount', 'Category', 'Account', 'Destination account', 'Date', 'Note'].join(','),
      ...rows.map((item) => [
        item.title, item.type, item.amount,
        item.categoryId ? categoryNames.get(item.categoryId.toString()) ?? '' : '',
        accountNames.get(item.accountId.toString()) ?? '',
        item.destinationAccountId ? accountNames.get(item.destinationAccountId.toString()) ?? '' : '',
        item.transactionDate.toISOString(), item.note,
      ].map(escape).join(',')),
    ].join('\r\n');
    res.type('text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="fintrack-transactions.csv"');
    return res.send(`\uFEFF${csv}`);
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  const id = objectId(req.params.id.toString());
  if (!id) return res.status(400).json({ success: false, message: 'Invalid transaction ID.' });
  try {
    const transaction = await TransactionModel.findOne({ _id: id, userId: req.user!.id });
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found.' });
    return res.json({ success: true, data: transaction });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  const id = objectId(req.params.id.toString());
  if (!id) return res.status(400).json({ success: false, message: 'Invalid transaction ID.' });
  const parsed = transactionSchema.partial().strict().refine((value) => Object.keys(value).length > 0).safeParse(req.body);
  if (!parsed.success) return respondInvalid(res, 'Invalid transaction payload.');
  const session = await mongoose.startSession();
  try {
    let updated: mongoose.HydratedDocument<unknown> | null = null;
    await session.withTransaction(async () => {
      const transaction = await TransactionModel.findOne({ _id: id, userId: req.user!.id }).session(session);
      if (!transaction) return;
      const candidate = {
        title: parsed.data.title ?? transaction.title,
        amount: parsed.data.amount ?? transaction.amount,
        type: parsed.data.type ?? transaction.type,
        categoryId: parsed.data.categoryId ?? transaction.categoryId?.toString(),
        accountId: parsed.data.accountId ?? transaction.accountId.toString(),
        destinationAccountId: parsed.data.destinationAccountId ?? transaction.destinationAccountId?.toString(),
        transactionDate: parsed.data.transactionDate ?? transaction.transactionDate.toISOString(),
        note: parsed.data.note ?? transaction.note,
      };
      const validation = transactionSchema.safeParse(candidate);
      if (!validation.success) throw Object.assign(new Error('Invalid transaction payload.'), { statusCode: 400 });
      const validationError = await referenceError(req.user!.id, validation.data, session, transaction.categoryId?.toString());
      if (validationError) throw Object.assign(new Error(validationError), { statusCode: 400 });
      Object.assign(transaction, {
        ...parsed.data,
        ...(parsed.data.accountId ? { accountId: objectId(parsed.data.accountId) } : {}),
        ...(parsed.data.categoryId !== undefined ? { categoryId: parsed.data.categoryId ? objectId(parsed.data.categoryId) : null } : {}),
        ...(parsed.data.destinationAccountId !== undefined ? { destinationAccountId: parsed.data.destinationAccountId ? objectId(parsed.data.destinationAccountId) : null } : {}),
        ...(parsed.data.transactionDate ? { transactionDate: new Date(parsed.data.transactionDate) } : {}),
      });
      updated = await transaction.save({ session });
    });
    if (!updated) return res.status(404).json({ success: false, message: 'Transaction not found.' });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return next(error);
  } finally {
    await session.endSession();
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  const id = objectId(req.params.id.toString());
  if (!id) return res.status(400).json({ success: false, message: 'Invalid transaction ID.' });
  try {
    const transaction = await TransactionModel.findOneAndDelete({ _id: id, userId: req.user!.id });
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found.' });
    return res.json({ success: true, data: transaction });
  } catch (error) {
    return next(error);
  }
});

export default router;
