import { Router } from 'express';
import { z } from 'zod';
import { BudgetModel } from '../models/Budget.js';
import { CategoryModel } from '../models/Category.js';
import { budgetUsage, dayEnd, dayStart, objectId, userObjectId } from '../utils/mongoFinance.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
});
const budgetFields = z.object({
  categoryId: z.string().min(1),
  amountLimit: z.number().int().positive().safe(),
  periodStart: dateOnly,
  periodEnd: dateOnly,
});
const budgetSchema = budgetFields.strict().refine((value) => value.periodStart <= value.periodEnd);

const expenseCategory = async (userId: string, categoryId: string) => {
  const _id = objectId(categoryId);
  return _id ? CategoryModel.findOne({
    _id,
    type: 'EXPENSE',
    isArchived: false,
    $or: [{ isSystem: true, userId: null }, { isSystem: false, userId }],
  }) : null;
};

const serializeBudget = async (userId: string, budget: any) => {
  const [category, usage] = await Promise.all([
    CategoryModel.findById(budget.categoryId).select('name').lean(),
    budgetUsage(userId, budget.categoryId, dayStart(budget.periodStart.toISOString()), dayEnd(budget.periodEnd.toISOString()), budget.amountLimit),
  ]);
  return { ...budget.toJSON(), categoryName: (category as { name?: string } | null)?.name ?? 'Archived category', ...usage };
};

const findOwnedBudget = (userId: string, id: string) => {
  const _id = objectId(id);
  return _id ? BudgetModel.findOne({ _id, userId }) : null;
};

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const budgets = await BudgetModel.find({ userId: req.user!.id }).sort({ periodStart: -1 });
    return res.json({ success: true, data: await Promise.all(budgets.map((budget) => serializeBudget(req.user!.id, budget))) });
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  const parsed = budgetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid budget payload.' });
  try {
    if (!await expenseCategory(req.user!.id, parsed.data.categoryId)) {
      return res.status(400).json({ success: false, message: 'Budget category must be an active expense category.' });
    }
    const categoryId = objectId(parsed.data.categoryId)!;
    const periodStart = dayStart(parsed.data.periodStart);
    const periodEnd = dayEnd(parsed.data.periodEnd);
    const duplicate = await BudgetModel.exists({ userId: req.user!.id, categoryId, periodStart, periodEnd });
    if (duplicate) return res.status(409).json({ success: false, message: 'A budget already exists for this category and period.' });
    const budget = await BudgetModel.create({
      userId: userObjectId(req.user!.id),
      categoryId,
      amountLimit: parsed.data.amountLimit,
      periodStart,
      periodEnd,
    });
    return res.status(201).json({ success: true, data: await serializeBudget(req.user!.id, budget) });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A budget already exists for this category and period.' });
    }
    return next(error);
  }
});

router.get('/:id/usage', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const budget = await findOwnedBudget(req.user!.id, req.params.id.toString());
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found.' });
    return res.json({ success: true, data: await serializeBudget(req.user!.id, budget) });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const budget = await findOwnedBudget(req.user!.id, req.params.id.toString());
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found.' });
    return res.json({ success: true, data: await serializeBudget(req.user!.id, budget) });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  const parsed = budgetFields.partial().strict().safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) return res.status(400).json({ success: false, message: 'Invalid budget payload.' });
  try {
    const budget = await findOwnedBudget(req.user!.id, req.params.id.toString());
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found.' });
    const current = {
      categoryId: parsed.data.categoryId ?? budget.categoryId.toString(),
      amountLimit: parsed.data.amountLimit ?? budget.amountLimit,
      periodStart: parsed.data.periodStart ?? budget.periodStart.toISOString().slice(0, 10),
      periodEnd: parsed.data.periodEnd ?? budget.periodEnd.toISOString().slice(0, 10),
    };
    const validated = budgetSchema.safeParse(current);
    if (!validated.success) return res.status(400).json({ success: false, message: 'Invalid budget period or limit.' });
    if (!await expenseCategory(req.user!.id, validated.data.categoryId)) {
      return res.status(400).json({ success: false, message: 'Budget category must be an active expense category.' });
    }
    const categoryId = objectId(validated.data.categoryId)!;
    const periodStart = dayStart(validated.data.periodStart);
    const periodEnd = dayEnd(validated.data.periodEnd);
    const duplicate = await BudgetModel.exists({
      _id: { $ne: budget._id }, userId: req.user!.id, categoryId, periodStart, periodEnd,
    });
    if (duplicate) return res.status(409).json({ success: false, message: 'A budget already exists for this category and period.' });
    budget.categoryId = categoryId;
    budget.amountLimit = validated.data.amountLimit;
    budget.periodStart = periodStart;
    budget.periodEnd = periodEnd;
    await budget.save();
    return res.json({ success: true, data: await serializeBudget(req.user!.id, budget) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const budget = await findOwnedBudget(req.user!.id, req.params.id.toString());
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found.' });
    await budget.deleteOne();
    return res.json({ success: true, data: budget });
  } catch (error) {
    return next(error);
  }
});

export default router;
