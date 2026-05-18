import { NextFunction, Request, Response } from 'express';
import morgan from 'morgan';
import logger from '../configs/logger';

const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export const morganMiddleware = morgan('combined', { stream: morganStream });

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const originalEnd = res.end.bind(res) as any;

  res.end = function (...args: any[]): any {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id,
      contentLength: res.getHeader('content-length'),
    };

    if (res.statusCode >= 500) {
      logger.error('Request error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request warning', logData);
    } else {
      logger.http('Request processed', logData);
    }

    return originalEnd(...args);
  };

  next();
};

export const performanceMonitor = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime();
  const originalEnd = res.end.bind(res) as any;

  res.end = function (...args: any[]): any {
    const diff = process.hrtime(start);
    const time = diff[0] * 1e3 + diff[1] * 1e-6;

    if (time > 1000) {
      logger.warn(`Slow request detected: ${req.method} ${req.originalUrl} took ${time.toFixed(2)}ms`);
    }

    return originalEnd(...args);
  };

  next();
};

export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  req.requestId = require('crypto').randomBytes(16).toString('hex');
  res.setHeader('X-Request-Id', req.requestId || '');
  next();
};
