import { Router } from 'express';
import { z } from 'zod';
import { UserModel } from '../models/User.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
});
const avatarValue = z.string().max(1_200_000).refine((value) =>
  value === '' ||
  /^https:\/\/[^\s]+$/i.test(value) ||
  /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(value),
);
const settingsSchema = z.object({
  defaultCurrency: z.literal('VND').optional(),
  name: z.string().trim().min(2).max(100).optional(),
  phoneNumber: z.string().trim().max(30).regex(/^[+\d\s().-]*$/).optional(),
  birthDate: dateOnly.nullable().optional(),
  avatarUrl: avatarValue.nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one setting is required.');

const serializeSettings = (user: {
  name: string;
  email: string;
  defaultCurrency: string;
  phoneNumber?: string;
  birthDate?: Date | null;
  avatarUrl?: string | null;
}) => ({
  name: user.name,
  email: user.email,
  defaultCurrency: user.defaultCurrency,
  phoneNumber: user.phoneNumber ?? '',
  birthDate: user.birthDate?.toISOString().slice(0, 10) ?? '',
  avatarUrl: user.avatarUrl || '/avatar-default.png',
});

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await UserModel.findById(req.user!.id).select('name email defaultCurrency phoneNumber birthDate avatarUrl');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, data: serializeSettings(user) });
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
    if (parsed.data.phoneNumber !== undefined) user.phoneNumber = parsed.data.phoneNumber;
    if (parsed.data.birthDate !== undefined) user.birthDate = parsed.data.birthDate ? new Date(`${parsed.data.birthDate}T00:00:00.000Z`) : undefined;
    if (parsed.data.avatarUrl !== undefined) user.avatarUrl = parsed.data.avatarUrl || undefined;
    await user.save();
    return res.json({ success: true, data: serializeSettings(user) });
  } catch (error) {
    return next(error);
  }
});

export default router;
