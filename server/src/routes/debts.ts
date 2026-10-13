import mongoose from 'mongoose';
import { Router } from 'express';
import { z } from 'zod';
import { AccountModel } from '../models/Account.js';
import { DebtModel } from '../models/Debt.js';
import { DebtPaymentModel } from '../models/DebtPayment.js';
import { debtOutstanding, objectId, userObjectId, vietnamDate } from '../utils/mongoFinance.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
});
const debtFields = z.object({
  personName: z.string().trim().min(2).max(100),
  type: z.enum(['BORROWED', 'LENT']),
  principalAmount: z.number().int().positive().safe(),
  startDate: dateOnly,
  dueDate: dateOnly,
  note: z.string().max(500).optional(),
});
const debtSchema = debtFields.strict().refine((value) => value.dueDate >= value.startDate);
const debtUpdateSchema = debtFields.pick({ personName: true, startDate: true, dueDate: true, note: true }).partial().strict();
const paymentSchema = z.object({
  amount: z.number().int().positive().safe(),
  paymentDate: dateOnly.optional(),
  accountId: z.string().optional(),
  note: z.string().max(500).optional(),
}).strict();

const getOwnedDebt = (userId: string, debtId: string) => {
  const _id = objectId(debtId);
  return _id ? DebtModel.findOne({ _id, userId }) : null;
};

const serializeDebt = async (userId: string, debt: any) => {
  const outstandingAmount = await debtOutstanding(userId, debt._id, debt.principalAmount);
  const status = outstandingAmount === 0
    ? 'PAID'
    : new Date(`${vietnamDate(debt.dueDate)}T23:59:59.999+07:00`) < new Date()
      ? 'OVERDUE'
      : 'ACTIVE';
  return { ...debt.toJSON(), outstandingAmount, status };
};

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const debts = await DebtModel.find({ userId: req.user!.id }).sort({ dueDate: 1 });
    return res.json({ success: true, data: await Promise.all(debts.map((debt) => serializeDebt(req.user!.id, debt))) });
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  const parsed = debtSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid debt payload.' });
  try {
    const debt = await DebtModel.create({
      ...parsed.data,
      userId: userObjectId(req.user!.id),
      startDate: new Date(`${parsed.data.startDate}T00:00:00+07:00`),
      dueDate: new Date(`${parsed.data.dueDate}T00:00:00+07:00`),
    });
    return res.status(201).json({ success: true, data: await serializeDebt(req.user!.id, debt) });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/payments', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const debt = await getOwnedDebt(req.user!.id, req.params.id.toString());
    if (!debt) return res.status(objectId(req.params.id.toString()) ? 404 : 400).json({ success: false, message: 'Debt not found or invalid ID.' });
    const payments = await DebtPaymentModel.find({ userId: req.user!.id, debtId: debt._id }).sort({ paymentDate: -1 });
    return res.json({ success: true, data: payments });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/payments', requireAuth, async (req: AuthRequest, res, next) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid debt payment payload.' });
  const debtId = objectId(req.params.id.toString());
  if (!debtId) return res.status(400).json({ success: false, message: 'Invalid debt ID.' });
  const session = await mongoose.startSession();
  try {
    let result: { payment: any; debt: any } | null = null;
    await session.withTransaction(async () => {
      const debt = await DebtModel.findOne({ _id: debtId, userId: req.user!.id }).session(session);
      if (!debt) return;
      if (parsed.data.accountId) {
        const accountId = objectId(parsed.data.accountId);
        const account = accountId
          ? await AccountModel.findOne({ _id: accountId, userId: req.user!.id, isArchived: false }).session(session)
          : null;
        if (!account) throw Object.assign(new Error('Payment account not found or archived.'), { statusCode: 400 });
      }
      const outstanding = await debtOutstanding(req.user!.id, debt._id, debt.principalAmount);
      if (parsed.data.amount > outstanding) {
        throw Object.assign(new Error(`Payment exceeds outstanding amount (${outstanding}).`), { statusCode: 400 });
      }
      debt.paidAmount += parsed.data.amount;
      await debt.save({ session });
      const [payment] = await DebtPaymentModel.create([{
        userId: userObjectId(req.user!.id),
        debtId: debt._id,
        amount: parsed.data.amount,
        paymentDate: parsed.data.paymentDate ? new Date(`${parsed.data.paymentDate}T00:00:00+07:00`) : new Date(),
        accountId: parsed.data.accountId ? objectId(parsed.data.accountId) : null,
        note: parsed.data.note,
      }], { session });
      result = { payment, debt };
    });
    const completed = result as { payment: any; debt: any } | null;
    if (!completed) return res.status(404).json({ success: false, message: 'Debt not found.' });
    return res.status(201).json({ success: true, data: { payment: completed.payment, debt: await serializeDebt(req.user!.id, completed.debt) } });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Invalid debt payment.' });
    }
    return next(error);
  } finally {
    await session.endSession();
  }
});

router.get('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const debt = await getOwnedDebt(req.user!.id, req.params.id.toString());
    if (!debt) return res.status(objectId(req.params.id.toString()) ? 404 : 400).json({ success: false, message: 'Debt not found or invalid ID.' });
    return res.json({ success: true, data: await serializeDebt(req.user!.id, debt) });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  const parsed = debtUpdateSchema.refine((value) => Object.keys(value).length > 0).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid debt payload.' });
  try {
    const debt = await getOwnedDebt(req.user!.id, req.params.id.toString());
    if (!debt) return res.status(objectId(req.params.id.toString()) ? 404 : 400).json({ success: false, message: 'Debt not found or invalid ID.' });
    const startDate = parsed.data.startDate ?? vietnamDate(debt.startDate);
    const dueDate = parsed.data.dueDate ?? vietnamDate(debt.dueDate);
    if (dueDate < startDate) return res.status(400).json({ success: false, message: 'dueDate must not precede startDate.' });
    Object.assign(debt, parsed.data, {
      ...(parsed.data.startDate ? { startDate: new Date(`${parsed.data.startDate}T00:00:00+07:00`) } : {}),
      ...(parsed.data.dueDate ? { dueDate: new Date(`${parsed.data.dueDate}T00:00:00+07:00`) } : {}),
    });
    await debt.save();
    return res.json({ success: true, data: await serializeDebt(req.user!.id, debt) });
  } catch (error) {
    return next(error);
  }
});

export default router;
