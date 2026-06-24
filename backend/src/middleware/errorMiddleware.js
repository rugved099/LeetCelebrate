/**
 * Global error handling middleware for Express.
 */
function errorHandler(err, req, res, next) {
  console.error('[SERVER ERROR]', err.stack || err.message || err);

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    success: false,
    error: {
      message,
      status,
      // Only show stack traces in development
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
  });
}

module.exports = {
  errorHandler,
};
