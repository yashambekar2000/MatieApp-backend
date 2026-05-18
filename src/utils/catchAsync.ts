import { NextFunction, Request, RequestHandler, Response } from 'express';
import logger from '../configs/logger';

const catchAsync = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      logger.error(`Async error: ${err.message}`, {
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        userId: req.user?.id,
      });
      next(err);
    });
  };
};

export default catchAsync;
