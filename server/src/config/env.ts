import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const jwtSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && !jwtSecret) {
  throw new Error('JWT_SECRET must be configured in production.');
}

export const env = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: jwtSecret || 'fintrack-dev-secret',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fintrack',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  appName: 'FinTrack',
};
