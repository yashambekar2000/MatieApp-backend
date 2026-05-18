import { NextFunction, Request, Response } from 'express';
import AuthService from '../services/authService';
import AppError from '../utils/AppError';
import catchAsync from '../utils/catchAsync';

export const protect = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not logged in. Please log in to access this resource.', 401));
  }

  const result = await AuthService.validateToken(token);
  if (!result) {
    return next(new AppError('Invalid or expired token. Please log in again.', 401));
  }

  req.user = result.user;
  req.session = result.session;
  req.token = token;

  next();
});

export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

export const optionalAuth = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.jwt) {
    token = req.cookies.jwt;
  }

  if (token) {
    const result = await AuthService.validateToken(token);
    if (result) {
      req.user = result.user;
      req.session = result.session;
      req.token = token;
    }
  }

  next();
});
