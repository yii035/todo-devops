import assert from 'node:assert/strict';
import { once } from 'node:events';
import { AddressInfo } from 'node:net';
import test from 'node:test';
import app from '../src/app.js';

test('serves Prometheus metrics publicly and records completed HTTP requests', async () => {
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const initialMetricsResponse = await fetch(`${base}/metrics`);
    assert.equal(initialMetricsResponse.status, 200);
    assert.match(initialMetricsResponse.headers.get('content-type') ?? '', /text\/plain/);
    assert.match(await initialMetricsResponse.text(), /fintrack_process_cpu_user_seconds_total/);

    const healthResponse = await fetch(`${base}/api/health`);
    assert.equal(healthResponse.status, 200);

    const metricsResponse = await fetch(`${base}/metrics`);
    const metrics = await metricsResponse.text();
    assert.match(metrics, /fintrack_http_requests_total\{method="GET",route="\/api\/health",status_code="200"\} 1/);
    assert.match(metrics, /fintrack_http_request_duration_ms_bucket\{le="5",method="GET",route="\/api\/health",status_code="200"\}/);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
