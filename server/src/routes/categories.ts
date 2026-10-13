import { Router } from 'express';
import { z } from 'zod';
import { CategoryModel } from '../models/Category.js';
import { objectId, userObjectId } from '../utils/mongoFinance.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();
const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  type: z.enum(['INCOME', 'EXPENSE']),
  icon: z.string().max(16).default('💰'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2563eb'),
}).strict();

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    type: z.enum(['INCOME', 'EXPENSE']).optional(),
    includeArchived: z.enum(['true', 'false']).default('false'),
  }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid category filters.' });
  try {
    const categories = await CategoryModel.find({
      $and: [
        { $or: [{ isSystem: true, userId: null }, { isSystem: false, userId: req.user!.id }] },
        ...(parsed.data.type ? [{ type: parsed.data.type }] : []),
        ...(parsed.data.includeArchived === 'true' ? [] : [{ isArchived: false }]),
      ],
    }).sort({ type: 1, name: 1 });
    return res.json({ success: true, data: categories });
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid category payload.' });
  try {
    const exists = await CategoryModel.findOne({
      userId: req.user!.id,
      isArchived: false,
      type: parsed.data.type,
      name: { $regex: `^${parsed.data.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    }).collation({ locale: 'vi', strength: 2 });
    if (exists) return res.status(409).json({ success: false, message: 'Category name already exists for this type.' });
    const category = await CategoryModel.create({ ...parsed.data, userId: userObjectId(req.user!.id), isSystem: false });
    return res.status(201).json({ success: true, data: category });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/archive', requireAuth, async (req: AuthRequest, res, next) => {
  const categoryId = objectId(req.params.id.toString());
  if (!categoryId) return res.status(400).json({ success: false, message: 'Invalid category ID.' });
  try {
    const category = await CategoryModel.findOne({ _id: categoryId, userId: req.user!.id, isSystem: false });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });
    category.isArchived = true;
    await category.save();
    return res.json({ success: true, data: category });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  const categoryId = objectId(req.params.id.toString());
  if (!categoryId) return res.status(400).json({ success: false, message: 'Invalid category ID.' });
  const parsed = categorySchema.partial().strict().refine((value) => Object.keys(value).length > 0).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid category payload.' });
  try {
    const category = await CategoryModel.findOne({ _id: categoryId, userId: req.user!.id, isSystem: false, isArchived: false });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });
    const name = parsed.data.name ?? category.name;
    const type = parsed.data.type ?? category.type;
    const duplicate = await CategoryModel.findOne({
      _id: { $ne: categoryId },
      userId: req.user!.id,
      isArchived: false,
      type,
      name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });
    if (duplicate) return res.status(409).json({ success: false, message: 'Category name already exists for this type.' });
    Object.assign(category, parsed.data);
    await category.save();
    return res.json({ success: true, data: category });
  } catch (error) {
    return next(error);
  }
});

export default router;
