import { Router } from 'express';
import mongoose from 'mongoose';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { AccountModel } from '../models/Account.js';
import { CategoryModel } from '../models/Category.js';
import { UserModel } from '../models/User.js';
import { comparePassword, createToken, hashPassword } from '../utils/auth.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { env } from '../config/env.js';

const router = Router();
const googleClient = new OAuth2Client();
const googleCallbackPath = '/api/v1/auth/google/callback';
const googleStateCookie = 'fintrack_google_oauth_state';
const googleProfileSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.boolean(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
});
const googleTokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string(),
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function googleOAuthConfigured() {
  return Boolean(env.googleClientId && env.googleClientSecret && env.googleRedirectUri);
}

function clearGoogleStateCookie(res: import('express').Response) {
  res.clearCookie(googleStateCookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: googleCallbackPath,
  });
}

function googleCallbackResult(res: import('express').Response, result: { token: string } | { error: string }) {
  const callbackUrl = new URL('/auth/google/callback', env.clientOrigin);
  callbackUrl.hash = new URLSearchParams(result).toString();
  return res.redirect(callbackUrl.toString());
}

async function getOrCreateGoogleUser(profile: z.infer<typeof googleProfileSchema>) {
  const googleId = profile.sub;
  const email = profile.email.toLowerCase();
  const linkedUser = await UserModel.findOne({ googleId });
  if (linkedUser) return linkedUser;

  const emailUser = await UserModel.findOne({ email });
  if (emailUser) {
    if (emailUser.googleId && emailUser.googleId !== googleId) return null;
    emailUser.googleId = googleId;
    emailUser.avatarUrl = profile.picture;
    await emailUser.save();
    return emailUser;
  }

  const session = await mongoose.startSession();
  try {
    let newUser: InstanceType<typeof UserModel> | null = null;
    await session.withTransaction(async () => {
      const [user] = await UserModel.create([{
        name: profile.name?.trim() || email.split('@')[0],
        email,
        googleId,
        avatarUrl: profile.picture,
        passwordHash: await hashPassword(randomBytes(48).toString('base64url')),
        defaultCurrency: 'VND',
      }], { session });
      newUser = user;
      await createDefaultFinancialRecords(user._id, session);
    });
    if (!newUser) throw new Error('Google account registration did not complete.');
    return newUser;
  } finally {
    await session.endSession();
  }
}

async function createDefaultFinancialRecords(userId: mongoose.Types.ObjectId, session: mongoose.ClientSession) {
  await AccountModel.create([{
    userId, name: 'Cash', type: 'CASH', openingBalance: 0, currency: 'VND',
  }], { session });
  await CategoryModel.insertMany([
    { userId, name: 'Salary', type: 'INCOME', icon: '💰', color: '#16a34a' },
    { userId, name: 'Other Income', type: 'INCOME', icon: '🎁', color: '#10b981' },
    { userId, name: 'Food', type: 'EXPENSE', icon: '🍽️', color: '#f59e0b' },
    { userId, name: 'Transportation', type: 'EXPENSE', icon: '🚗', color: '#ef4444' },
    { userId, name: 'Other', type: 'EXPENSE', icon: '📌', color: '#2563eb' },
  ], { session });
}

router.get('/google/config', (_req, res) => {
  if (!env.googleClientId) {
    return res.status(503).json({ success: false, message: 'Google sign-in is not configured.' });
  }
  return res.json({ success: true, data: { clientId: env.googleClientId } });
});

router.post('/google/credential', async (req, res, next) => {
  if (!env.googleClientId) {
    return res.status(503).json({ success: false, message: 'Google sign-in is not configured.' });
  }
  const parsed = z.object({ credential: z.string().min(1) }).strict().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid Google credential.' });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: parsed.data.credential,
      audience: env.googleClientId,
    });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid Google credential.' });
  }

  const profile = googleProfileSchema.safeParse({
    sub: payload?.sub,
    email: payload?.email,
    email_verified: payload?.email_verified === true,
    name: payload?.name,
    picture: payload?.picture,
  });
  if (!profile.success || !profile.data.email_verified) {
    return res.status(401).json({ success: false, message: 'Invalid Google credential.' });
  }

  try {
    const user = await getOrCreateGoogleUser(profile.data);
    if (!user) {
      return res.status(409).json({ success: false, message: 'This email is linked to another Google account.' });
    }
    return res.json({ success: true, data: { token: createToken(user._id.toString()) } });
  } catch (error) {
    return next(error);
  }
});

router.get('/google', (req, res) => {
  if (!googleOAuthConfigured()) {
    return res.status(503).json({ success: false, message: 'Google sign-in is not configured.' });
  }

  const state = randomBytes(32).toString('base64url');
  res.cookie(googleStateCookie, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: googleCallbackPath,
    maxAge: 10 * 60 * 1000,
  });

  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizationUrl.search = new URLSearchParams({
    client_id: env.googleClientId!,
    redirect_uri: env.googleRedirectUri!,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  }).toString();
  return res.redirect(authorizationUrl.toString());
});

router.get('/google/callback', async (req, res, next) => {
  if (!googleOAuthConfigured()) {
    return res.status(503).json({ success: false, message: 'Google sign-in is not configured.' });
  }

  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const stateCookie = req.headers.cookie?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${googleStateCookie}=`))
    ?.slice(googleStateCookie.length + 1) ?? '';
  clearGoogleStateCookie(res);
  if (!state || !stateCookie || state.length !== stateCookie.length ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(stateCookie))) {
    return googleCallbackResult(res, { error: 'google_login_failed' });
  }

  if (typeof req.query.error === 'string' || typeof req.query.code !== 'string') {
    return googleCallbackResult(res, { error: 'google_login_failed' });
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: env.googleClientId!,
        client_secret: env.googleClientSecret!,
        redirect_uri: env.googleRedirectUri!,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResponse.ok) throw new Error('Google token exchange failed.');
    const token = googleTokenSchema.safeParse(await tokenResponse.json());
    if (!token.success || token.data.token_type.toLowerCase() !== 'bearer') {
      throw new Error('Google returned an invalid token response.');
    }

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token.data.access_token}` },
    });
    if (!profileResponse.ok) throw new Error('Google profile request failed.');
    const profile = googleProfileSchema.safeParse(await profileResponse.json());
    if (!profile.success || !profile.data.email_verified) {
      return googleCallbackResult(res, { error: 'google_login_failed' });
    }

    const user = await getOrCreateGoogleUser(profile.data);
    if (!user) return googleCallbackResult(res, { error: 'google_login_failed' });
    return googleCallbackResult(res, { token: createToken(user._id.toString()) });
  } catch (error) {
    return next(error);
  }
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
      await createDefaultFinancialRecords(user._id, session);
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
