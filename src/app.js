const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/simulate-issue', (_req, _res, next) => {
  const err = new Error('Simulated bike store failure for observability demo');
  err.code = 'BIKE_STORE_SIMULATION';
  next(err);
});

app.use((err, req, res, _next) => {
  const errorId = crypto.randomUUID();

  console.error(
    JSON.stringify({
      level: 'error',
      errorId,
      message: err.message,
      code: err.code || 'UNHANDLED_ERROR',
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString(),
      stack: err.stack,
    }),
  );

  res.status(500).json({
    error: 'Internal Server Error',
    errorId,
    message: 'A simulated error was generated. Check app logs.',
  });
});

module.exports = app;
