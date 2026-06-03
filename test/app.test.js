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
  const response = await request(app).post('/api/simulate-issue');

  assert.equal(response.status, 500);
  assert.equal(response.body.error, 'Internal Server Error');
  assert.match(response.body.errorId, /^[a-f0-9-]{36}$/i);
  assert.equal(response.body.message, 'A simulated error was generated. Check app logs.');
});
