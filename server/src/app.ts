import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import transactionRoutes from './routes/transactions.js';
import accountRoutes from './routes/accounts.js';
import categoryRoutes from './routes/categories.js';
import budgetRoutes from './routes/budgets.js';
import debtRoutes from './routes/debts.js';
import reportRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';
import notificationRoutes from './routes/notifications.js';
import chatRoutes from './routes/chat.js';
import { env } from './config/env.js';
import { httpRequestDurationMs, httpRequestsTotal, register } from './metrics.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requestMetricsMiddleware: RequestHandler = (req, res, next) => {
  const startTime = process.hrtime.bigint();

  res.once('finish', () => {
    const routePath = req.route?.path;
    const route = routePath
      ? `${req.baseUrl}${Array.isArray(routePath) ? routePath.join('|') : routePath}`
      : 'unmatched';
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;

    httpRequestsTotal.inc(labels);
    httpRequestDurationMs.observe(labels, durationMs);
  });

  next();
};

app.use(cors({ origin: env.clientOrigin }));
app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  contentSecurityPolicy: {
    directives: {
      scriptSrc: ["'self'", 'https://accounts.google.com'],
      frameSrc: ["'self'", 'https://accounts.google.com'],
      connectSrc: ["'self'", 'https://accounts.google.com'],
    },
  },
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(requestMetricsMiddleware);

app.get('/api/health', (_, res) => {
  res.json({ success: true, message: 'FinTrack API is running.' });
});

app.get('/metrics', async (_req, res, next) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    next(error);
  }
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/accounts', accountRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/budgets', budgetRoutes);
app.use('/api/v1/debts', debtRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/chat', chatRoutes);

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error &&
    typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600
    ? error.statusCode
    : 500;
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  console.error(`API request failed (${errorName}).`);
  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'An unexpected server error occurred.' : error instanceof Error ? error.message : 'Request failed.',
  });
};
app.use(errorHandler);

const distPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(distPath));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  return res.sendFile(path.join(distPath, 'index.html'));
});

export default app;
