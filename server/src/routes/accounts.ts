import { Router } from 'express';
import { z } from 'zod';
import { AccountModel } from '../models/Account.js';
import { TransactionModel } from '../models/Transaction.js';
import { accountBalance, getAccountById, objectId, userObjectId } from '../utils/mongoFinance.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();
const accountSchema = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(['CASH', 'BANK', 'EWALLET', 'OTHER']),
  openingBalance: z.number().int().nonnegative().safe().default(0),
  currency: z.literal('VND').default('VND'),
}).strict();
const accountUpdateSchema = accountSchema.pick({ name: true, type: true }).partial().strict().refine((value) => Object.keys(value).length > 0);

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const accounts = await AccountModel.find({ userId: req.user!.id, isArchived: false }).sort({ createdAt: 1 });
    const data = await Promise.all(accounts.map(async (account) => ({
      ...account.toJSON(),
      currentBalance: await accountBalance(req.user!.id, account._id, account.openingBalance),
    })));
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid account payload.' });
  try {
    const account = await AccountModel.create({ ...parsed.data, userId: userObjectId(req.user!.id) });
    return res.status(201).json({ success: true, data: { ...account.toJSON(), currentBalance: account.openingBalance } });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/transactions', requireAuth, async (req: AuthRequest, res, next) => {
  const accountId = objectId(req.params.id.toString());
  if (!accountId) return res.status(400).json({ success: false, message: 'Invalid account ID.' });
  try {
    const account = await AccountModel.findOne({ _id: accountId, userId: req.user!.id });
    if (!account) return res.status(404).json({ success: false, message: 'Account not found.' });
    const transactions = await TransactionModel.find({
      userId: req.user!.id,
      $or: [{ accountId }, { destinationAccountId: accountId }],
    }).sort({ transactionDate: -1 });
    return res.json({ success: true, data: transactions });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  const accountId = objectId(req.params.id.toString());
  if (!accountId) return res.status(400).json({ success: false, message: 'Invalid account ID.' });
  try {
    const account = await AccountModel.findOne({ _id: accountId, userId: req.user!.id });
    if (!account) return res.status(404).json({ success: false, message: 'Account not found.' });
    return res.json({ success: true, data: { ...account.toJSON(), currentBalance: await accountBalance(req.user!.id, account._id, account.openingBalance) } });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/archive', requireAuth, async (req: AuthRequest, res, next) => {
  const accountId = objectId(req.params.id.toString());
  if (!accountId) return res.status(400).json({ success: false, message: 'Invalid account ID.' });
  try {
    const account = await AccountModel.findOneAndUpdate(
      { _id: accountId, userId: req.user!.id, isArchived: false },
      { isArchived: true },
      { new: true },
    );
    if (!account) return res.status(404).json({ success: false, message: 'Account not found.' });
    return res.json({ success: true, data: account });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  const accountId = objectId(req.params.id.toString());
  if (!accountId) return res.status(400).json({ success: false, message: 'Invalid account ID.' });
  const parsed = accountUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid account payload.' });
  try {
    const account = await AccountModel.findOneAndUpdate(
      { _id: accountId, userId: req.user!.id, isArchived: false },
      parsed.data,
      { new: true, runValidators: true },
    );
    if (!account) return res.status(404).json({ success: false, message: 'Account not found.' });
    return res.json({ success: true, data: { ...account.toJSON(), currentBalance: await accountBalance(req.user!.id, account._id, account.openingBalance) } });
  } catch (error) {
    return next(error);
  }
});

export default router;
