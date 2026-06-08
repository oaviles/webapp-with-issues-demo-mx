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
  const originalConsoleError = console.error;
  let loggedPayload;

  console.error = (message) => {
    loggedPayload = JSON.parse(message);
  };

  const response = await request(app).post('/api/simulate-issue');

  try {
    assert.equal(response.status, 500);
    assert.equal(response.body.error, 'Internal Server Error');
    assert.match(response.body.errorId, /^[a-f0-9-]{36}$/i);
    assert.equal(response.body.message, 'A simulated error was generated. Check app logs.');
    assert.equal(loggedPayload.source, 'bike-store-webapp');
    assert.equal(loggedPayload.errorType, 'APPLICATION_EXCEPTION');
    assert.equal(loggedPayload.code, 'BIKE_STORE_SIMULATION');
  } finally {
    console.error = originalConsoleError;
  }
});
