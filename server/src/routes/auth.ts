import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { AccountModel } from '../models/Account.js';
import { CategoryModel } from '../models/Category.js';
import { UserModel } from '../models/User.js';
import { comparePassword, createToken, hashPassword } from '../utils/auth.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post('/register', async (req, res, next) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid registration payload.', errors: parsed.error.flatten() });
  }

  const session = await mongoose.startSession();
  try {
    let newUser: InstanceType<typeof UserModel> | null = null;
    await session.withTransaction(async () => {
      const [user] = await UserModel.create([{
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        passwordHash: await hashPassword(parsed.data.password),
        defaultCurrency: 'VND',
      }], { session });
      newUser = user;
      await AccountModel.create([{
        userId: user._id, name: 'Cash', type: 'CASH', openingBalance: 0, currency: 'VND',
      }], { session });
      await CategoryModel.insertMany([
        { userId: user._id, name: 'Salary', type: 'INCOME', icon: '💰', color: '#16a34a' },
        { userId: user._id, name: 'Other Income', type: 'INCOME', icon: '🎁', color: '#10b981' },
        { userId: user._id, name: 'Food', type: 'EXPENSE', icon: '🍽️', color: '#f59e0b' },
        { userId: user._id, name: 'Transportation', type: 'EXPENSE', icon: '🚗', color: '#ef4444' },
        { userId: user._id, name: 'Other', type: 'EXPENSE', icon: '📌', color: '#2563eb' },
      ], { session });
    });
    if (!newUser) throw new Error('User registration did not complete.');
    const token = createToken(newUser._id.toString());
    return res.status(201).json({ success: true, data: { user: { id: newUser._id, name: newUser.name, email: newUser.email }, token } });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email already exists.' });
    }
    return next(error);
  } finally {
    await session.endSession();
  }
});

router.post('/login', async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid login payload.' });
  }

  try {
    const user = await UserModel.findOne({ email: parsed.data.email.toLowerCase() });
    if (!user || !await comparePassword(parsed.data.password, user.passwordHash)) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    const token = createToken(user._id.toString());
    return res.json({ success: true, data: { user: { id: user._id, name: user.name, email: user.email }, token } });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
  const user = await UserModel.findById(req.user!.id).select('_id name email defaultCurrency');
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  return res.json({ success: true, data: { id: user._id, name: user.name, email: user.email, defaultCurrency: user.defaultCurrency } });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', requireAuth, (_req, res) => {
  return res.json({ success: true, message: 'Logged out. Remove the access token from the client.' });
});

router.patch('/change-password', requireAuth, async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(6).max(128),
  }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid password update payload.' });
  try {
  const user = await UserModel.findById(req.user!.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  if (!await comparePassword(parsed.data.currentPassword, user.passwordHash)) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
  }
  user.passwordHash = await hashPassword(parsed.data.newPassword);
  await user.save();
  return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    return next(error);
  }
});

export default router;
