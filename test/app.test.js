const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

test.afterEach(() => {
  delete process.env.ENABLE_SIMULATION_ENDPOINT;
  delete process.env.WEBSITE_SITE_NAME;
});

test('GET /api/health returns ok status', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
});

test('POST /api/simulate-issue returns 500 and error details', async () => {
  process.env.ENABLE_SIMULATION_ENDPOINT = 'true';

  const response = await request(app).post('/api/simulate-issue');

  assert.equal(response.status, 500);
  assert.equal(response.body.error, 'Internal Server Error');
  assert.match(response.body.errorId, /^[a-f0-9-]{36}$/i);
  assert.equal(response.body.message, 'A simulated error was generated. Check app logs.');
});

test('POST /api/simulate-issue is disabled by default on Azure App Service', async () => {
  process.env.WEBSITE_SITE_NAME = 'dynatrace-webapp-demo-mx';

  const response = await request(app).post('/api/simulate-issue');

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    error: 'Not Found',
    message: 'Simulation endpoint is disabled in this environment.',
  });
});

test('POST /api/simulate-issue includes trace context in structured error logs', async () => {
  process.env.ENABLE_SIMULATION_ENDPOINT = 'true';

  const originalConsoleError = console.error;
  const messages = [];
  console.error = (message) => messages.push(message);

  try {
    const response = await request(app)
      .post('/api/simulate-issue')
      .set('traceparent', '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');

    assert.equal(response.status, 500);
    assert.equal(messages.length, 1);

    const logEntry = JSON.parse(messages[0]);
    assert.equal(logEntry.trace_id, '4bf92f3577b34da6a3ce929d0e0e4736');
    assert.equal(logEntry.span_id, '00f067aa0ba902b7');
  } finally {
    console.error = originalConsoleError;
  }
});
