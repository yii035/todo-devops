import { Router } from 'express';
import { z } from 'zod';
import { UserModel } from '../models/User.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();
const settingsSchema = z.object({
  defaultCurrency: z.literal('VND').optional(),
  name: z.string().trim().min(2).max(100).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one setting is required.');

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await UserModel.findById(req.user!.id).select('name email defaultCurrency');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, data: { name: user.name, email: user.email, defaultCurrency: user.defaultCurrency } });
  } catch (error) {
    return next(error);
  }
});

router.patch('/', requireAuth, async (req: AuthRequest, res, next) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid settings payload.' });
  }

  try {
    const user = await UserModel.findById(req.user!.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (parsed.data.name !== undefined) user.name = parsed.data.name;
    if (parsed.data.defaultCurrency !== undefined) user.defaultCurrency = parsed.data.defaultCurrency;
    await user.save();
    return res.json({ success: true, data: { name: user.name, email: user.email, defaultCurrency: user.defaultCurrency } });
  } catch (error) {
    return next(error);
  }
});

export default router;
