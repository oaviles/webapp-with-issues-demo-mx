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

test('POST /api/simulate-issue returns 404 in production when simulation is disabled', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlag = process.env.SIMULATE_ISSUE_ENABLED;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.SIMULATE_ISSUE_ENABLED;

    const response = await request(app).post('/api/simulate-issue');

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, {
      error: 'Not Found',
      message:
        'Simulation endpoint is disabled. Set SIMULATE_ISSUE_ENABLED=true to enable it in production.',
    });
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalFlag === undefined) {
      delete process.env.SIMULATE_ISSUE_ENABLED;
    } else {
      process.env.SIMULATE_ISSUE_ENABLED = originalFlag;
    }
  }
});

test('POST /api/simulate-issue returns 500 in production when simulation is enabled', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlag = process.env.SIMULATE_ISSUE_ENABLED;

  try {
    process.env.NODE_ENV = 'production';
    process.env.SIMULATE_ISSUE_ENABLED = 'true';

    const response = await request(app).post('/api/simulate-issue');

    assert.equal(response.status, 500);
    assert.equal(response.body.error, 'Internal Server Error');
    assert.match(response.body.errorId, /^[a-f0-9-]{36}$/i);
    assert.equal(response.body.message, 'A simulated error was generated. Check app logs.');
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalFlag === undefined) {
      delete process.env.SIMULATE_ISSUE_ENABLED;
    } else {
      process.env.SIMULATE_ISSUE_ENABLED = originalFlag;
    }
  }
});
