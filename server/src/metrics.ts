import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const register = new Registry();

collectDefaultMetrics({
  prefix: 'fintrack_',
  register,
});

export const httpRequestsTotal = new Counter({
  name: 'fintrack_http_requests_total',
  help: 'Total number of completed HTTP requests.',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDurationMs = new Histogram({
  name: 'fintrack_http_request_duration_ms',
  help: 'HTTP request duration in milliseconds.',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [register],
});
