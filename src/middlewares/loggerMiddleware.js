const morgan = require('morgan');
const logger = require('../configs/logger');

// Create morgan stream for HTTP logging
const morganStream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Morgan middleware for HTTP request logging
const morganMiddleware = morgan('combined', { stream: morganStream });

// Custom request logger
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override end function to log after response is sent
  res.end = function(...args) {
    const duration = Date.now() - start;
    
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id,
      contentLength: res.get('content-length'),
    };
    
    if (res.statusCode >= 500) {
      logger.error('Request error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request warning', logData);
    } else {
      logger.http('Request processed', logData);
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
};

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const start = process.hrtime();
  
  const originalEnd = res.end;
  res.end = function(...args) {
    const diff = process.hrtime(start);
    const time = diff[0] * 1e3 + diff[1] * 1e-6;
    
    if (time > 1000) {
      logger.warn(`Slow request detected: ${req.method} ${req.originalUrl} took ${time.toFixed(2)}ms`);
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
};

// Request ID middleware
const requestId = (req, res, next) => {
  req.requestId = require('crypto').randomBytes(16).toString('hex');
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

module.exports = {
  morganMiddleware,
  requestLogger,
  performanceMonitor,
  requestId,
};