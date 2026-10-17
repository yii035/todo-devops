import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const jwtSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && !jwtSecret) {
  throw new Error('JWT_SECRET must be configured in production.');
}

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();

export const env = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: jwtSecret || 'fintrack-dev-secret',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fintrack',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  googleClientId,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim(),
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI?.trim(),
  appName: 'FinTrack',
};
