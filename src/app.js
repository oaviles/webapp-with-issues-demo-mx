const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const simulationRequestsByIp = new Map();
const simulationWindowMs = 60 * 1000;
const simulationMaxRequestsPerWindow = 5;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const extractTraceContext = (req) => {
  const traceparent = req.get('traceparent');

  if (!traceparent) {
    return { trace_id: null, span_id: null };
  }

  const parts = traceparent.trim().split('-');
  if (parts.length !== 4) {
    return { trace_id: null, span_id: null };
  }

  const [, traceId, spanId] = parts;
  const isValidTraceId = /^[a-f0-9]{32}$/i.test(traceId);
  const isValidSpanId = /^[a-f0-9]{16}$/i.test(spanId);

  return {
    trace_id: isValidTraceId ? traceId : null,
    span_id: isValidSpanId ? spanId : null,
  };
};

const getClientIp = (req) => {
  const forwardedFor = req.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || 'unknown';
};

const logEvent = (level, req, payload) => {
  const traceContext = extractTraceContext(req);
  const logPayload = JSON.stringify({
    level,
    ...traceContext,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ...payload,
  });

  if (level === 'error') {
    console.error(logPayload);
    return;
  }

  console.warn(logPayload);
};

const isSimulationEnabled = () => process.env.ALLOW_SIMULATED_ISSUES === 'true';

const isRateLimited = (req) => {
  const now = Date.now();
  const clientIp = getClientIp(req);
  const recentRequests = (simulationRequestsByIp.get(clientIp) || []).filter(
    (timestamp) => now - timestamp < simulationWindowMs,
  );

  if (recentRequests.length >= simulationMaxRequestsPerWindow) {
    simulationRequestsByIp.set(clientIp, recentRequests);
    return true;
  }

  recentRequests.push(now);
  simulationRequestsByIp.set(clientIp, recentRequests);
  return false;
};

app.post('/api/simulate-issue', (req, res, next) => {
  if (!isSimulationEnabled()) {
    logEvent('warn', req, {
      code: 'BIKE_STORE_SIMULATION_DISABLED',
      message: 'Simulation endpoint blocked because ALLOW_SIMULATED_ISSUES is not enabled',
    });

    res.status(403).json({
      error: 'Forbidden',
      code: 'BIKE_STORE_SIMULATION_DISABLED',
      message: 'Simulation endpoint is disabled in this environment.',
    });
    return;
  }

  if (isRateLimited(req)) {
    logEvent('warn', req, {
      code: 'BIKE_STORE_SIMULATION_RATE_LIMITED',
      message: 'Simulation endpoint rate limit exceeded',
    });

    res.status(429).json({
      error: 'Too Many Requests',
      code: 'BIKE_STORE_SIMULATION_RATE_LIMITED',
      message: 'Simulation endpoint is rate limited. Try again later.',
    });
    return;
  }

  const err = new Error('Simulated bike store failure for observability demo');
  err.code = 'BIKE_STORE_SIMULATION';
  next(err);
});

app.use((err, req, res, _next) => {
  const errorId = crypto.randomUUID();
  logEvent('error', req, {
    errorId,
    message: err.message,
    code: err.code || 'UNHANDLED_ERROR',
    stack: err.stack,
  });

  res.status(500).json({
    error: 'Internal Server Error',
    errorId,
    message: 'A simulated error was generated. Check app logs.',
  });
});

module.exports = app;
