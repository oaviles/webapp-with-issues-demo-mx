const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

test('GET /api/health returns ok status', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
});

test('POST /api/simulate-issue returns 500 and error details', async () => {
  app._resetSimulationRequests();
  const response = await request(app).post('/api/simulate-issue');

  assert.equal(response.status, 500);
  assert.equal(response.body.error, 'Internal Server Error');
  assert.match(response.body.errorId, /^[a-f0-9-]{36}$/i);
  assert.equal(response.body.message, 'A simulated error was generated. Check app logs.');
});

test('POST /api/simulate-issue handles traceparent header without error', async () => {
  app._resetSimulationRequests();
  const response = await request(app)
    .post('/api/simulate-issue')
    .set('traceparent', '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');

  assert.equal(response.status, 500);
  assert.match(response.body.errorId, /^[a-f0-9-]{36}$/i);
});

test('POST /api/simulate-issue returns 429 after rate limit is exceeded', async () => {
  app._resetSimulationRequests();
  const limit = parseInt(process.env.SIMULATE_RATE_LIMIT || '5', 10);

  for (let i = 0; i < limit; i++) {
    const res = await request(app).post('/api/simulate-issue');
    assert.equal(res.status, 500, `request ${i + 1} should succeed`);
  }

  const over = await request(app).post('/api/simulate-issue');
  assert.equal(over.status, 429);
  assert.equal(over.body.error, 'Too Many Requests');
});
