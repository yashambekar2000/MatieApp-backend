import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import AppError from '../utils/AppError';

const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => err.msg);
    return next(new AppError(errorMessages.join(', '), 400));
  }
  next();
};

const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  const sanitize = (obj: unknown): unknown => {
    if (typeof obj === 'string') {
      return obj.replace(/[<>]/g, '');
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => sanitize(item));
    }

    if (typeof obj === 'object' && obj !== null) {
      const sanitized: Record<string, unknown> = {};
      Object.keys(obj).forEach((key) => {
        sanitized[key] = sanitize((obj as Record<string, unknown>)[key]);
      });
      return sanitized;
    }

    return obj;
  };

  req.body = sanitize(req.body) as any;
  req.query = sanitize(req.query) as any;
  req.params = sanitize(req.params) as any;

  next();
};

export { validate, sanitizeInput };
