import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UserModel } from '../models/User.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as { userId: string };
    const user = await UserModel.findById(payload.userId).select('_id name email');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    };
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }
    return next(error);
  }
};
