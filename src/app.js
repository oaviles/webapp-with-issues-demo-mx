const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();

const getTraceContext = (req) => {
  const traceparent = req.get('traceparent');

  if (!traceparent) {
    return { traceId: null, spanId: null };
  }

  const [, traceId, spanId] = traceparent.split('-');

  return {
    traceId: traceId || null,
    spanId: spanId || null,
  };
};

const isSimulationEnabled = () => {
  const flag = process.env.ENABLE_SIMULATION_ENDPOINT;

  if (flag === 'true') {
    return true;
  }

  if (flag === 'false') {
    return false;
  }

  return !process.env.WEBSITE_SITE_NAME;
};

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/simulate-issue', (req, res, next) => {
  if (!isSimulationEnabled()) {
    res.status(404).json({
      error: 'Not Found',
      message: 'Simulation endpoint is disabled in this environment.',
    });
    return;
  }

  const err = new Error('Simulated bike store failure for observability demo');
  err.code = 'BIKE_STORE_SIMULATION';
  next(err);
});

app.use((err, req, res, _next) => {
  const errorId = crypto.randomUUID();
  const { traceId, spanId } = getTraceContext(req);

  console.error(
    JSON.stringify({
      level: 'error',
      errorId,
      message: err.message,
      code: err.code || 'UNHANDLED_ERROR',
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString(),
      trace_id: traceId,
      span_id: spanId,
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
