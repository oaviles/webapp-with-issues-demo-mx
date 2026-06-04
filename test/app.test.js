const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

test.beforeEach(() => {
  process.env.ALLOW_SIMULATED_ISSUES = 'true';
});

test.afterEach(() => {
  delete process.env.ALLOW_SIMULATED_ISSUES;
});

test('GET /api/health returns ok status', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
});

test('POST /api/simulate-issue returns 500 and error details', async () => {
  const response = await request(app).post('/api/simulate-issue');

  assert.equal(response.status, 500);
  assert.equal(response.body.error, 'Internal Server Error');
  assert.match(response.body.errorId, /^[a-f0-9-]{36}$/i);
  assert.equal(response.body.message, 'A simulated error was generated. Check app logs.');
});

test('POST /api/simulate-issue returns 403 when simulation endpoint is disabled', async () => {
  delete process.env.ALLOW_SIMULATED_ISSUES;
  const response = await request(app).post('/api/simulate-issue');

  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'Forbidden');
  assert.equal(response.body.code, 'BIKE_STORE_SIMULATION_DISABLED');
});

test('POST /api/simulate-issue returns 429 when rate limit is exceeded', async () => {
  const clientIp = '203.0.113.10';

  for (let index = 0; index < 5; index += 1) {
    const response = await request(app).post('/api/simulate-issue').set('x-forwarded-for', clientIp);
    assert.equal(response.status, 500);
  }

  const rateLimitedResponse = await request(app)
    .post('/api/simulate-issue')
    .set('x-forwarded-for', clientIp);

  assert.equal(rateLimitedResponse.status, 429);
  assert.equal(rateLimitedResponse.body.error, 'Too Many Requests');
  assert.equal(rateLimitedResponse.body.code, 'BIKE_STORE_SIMULATION_RATE_LIMITED');
});

test('POST /api/simulate-issue logs trace_id and span_id when traceparent is present', async (t) => {
  const consoleErrorMock = t.mock.method(console, 'error', () => {});
  const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
  const spanId = '00f067aa0ba902b7';

  const response = await request(app)
    .post('/api/simulate-issue')
    .set('x-forwarded-for', '203.0.113.11')
    .set('traceparent', `00-${traceId}-${spanId}-01`);

  assert.equal(response.status, 500);
  assert.equal(consoleErrorMock.mock.calls.length, 1);

  const [loggedPayload] = consoleErrorMock.mock.calls[0].arguments;
  const parsedPayload = JSON.parse(loggedPayload);
  assert.equal(parsedPayload.trace_id, traceId);
  assert.equal(parsedPayload.span_id, spanId);
});
