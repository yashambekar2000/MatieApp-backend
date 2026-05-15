const logger = require('../configs/logger');

module.exports = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => {
      logger.error(`Async error: ${err.message}`, { 
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        userId: req.user?.id
      });
      next(err);
    });
  };
};