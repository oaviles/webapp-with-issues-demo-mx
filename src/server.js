const app = require('./app');

const port = process.env.PORT || 3000;

// Catch synchronous exceptions that escape all Express error handlers.
// Logs use BIKE_STORE_UNCAUGHT_EXCEPTION so Dynatrace alerts can target this
// specific code rather than generic ERROR noise.
process.on('uncaughtException', (err) => {
  console.error(
    JSON.stringify({
      level: 'error',
      code: 'BIKE_STORE_UNCAUGHT_EXCEPTION',
      message: err.message,
      timestamp: new Date().toISOString(),
      stack: err.stack,
    }),
  );
  process.exit(1);
});

// Catch unhandled promise rejections with a distinct code for alert targeting.
process.on('unhandledRejection', (reason) => {
  console.error(
    JSON.stringify({
      level: 'error',
      code: 'BIKE_STORE_UNHANDLED_REJECTION',
      message: String(reason),
      timestamp: new Date().toISOString(),
    }),
  );
});

app.listen(port, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      code: 'BIKE_STORE_STARTUP',
      message: `Bike store demo app listening on port ${port}`,
      timestamp: new Date().toISOString(),
    }),
  );
});
