const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();

// In-memory rate limiter for the simulation endpoint.
// Limit is configurable via the SIMULATE_RATE_LIMIT environment variable
// (default: 5 requests per minute per client IP).
const simulationRequests = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = parseInt(process.env.SIMULATE_RATE_LIMIT || '5', 10);

function simulationRateLimiter(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  const timestamps = (simulationRequests.get(key) || []).filter((t) => t > windowStart);
  timestamps.push(now);
  simulationRequests.set(key, timestamps);

  if (timestamps.length > RATE_LIMIT_MAX) {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Simulation endpoint rate limit exceeded. Try again later.',
    });
    return;
  }
  next();
}

// Parse a W3C traceparent header (https://www.w3.org/TR/trace-context/) to
// extract traceId and spanId so they appear in structured error logs and enable
// correlation with Dynatrace distributed traces.
function parseTraceparent(header) {
  if (!header) return { traceId: null, spanId: null };
  const parts = header.split('-');
  if (parts.length < 4) return { traceId: null, spanId: null };
  return { traceId: parts[1] || null, spanId: parts[2] || null };
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/simulate-issue', simulationRateLimiter, (_req, _res, next) => {
  const err = new Error('Simulated bike store failure for observability demo');
  err.code = 'BIKE_STORE_SIMULATION';
  next(err);
});

app.use((err, req, res, _next) => {
  const errorId = crypto.randomUUID();
  const isSimulation = err.code === 'BIKE_STORE_SIMULATION';
  const { traceId, spanId } = parseTraceparent(req.headers['traceparent']);

  // Simulation errors are expected demo noise; log them at warn level so that
  // real application failures logged at error level remain high-signal in
  // Dynatrace and alerting pipelines.
  const logEntry = JSON.stringify({
    level: isSimulation ? 'warn' : 'error',
    category: isSimulation ? 'simulation' : 'app_error',
    errorId,
    message: err.message,
    code: err.code || 'UNHANDLED_ERROR',
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString(),
    traceId,
    spanId,
    stack: err.stack,
  });

  if (isSimulation) {
    console.warn(logEntry);
  } else {
    console.error(logEntry);
  }

  res.status(500).json({
    error: 'Internal Server Error',
    errorId,
    message: 'A simulated error was generated. Check app logs.',
  });
});

module.exports = app;
// Exposed for test isolation only – do not call in production code.
app._resetSimulationRequests = () => simulationRequests.clear();
