import { ErrorRequestHandler } from 'express';
import logger from '../configs/logger';
import AppError from '../utils/AppError';
import { Prisma } from '@prisma/client';

const handlePrismaError = (err: Prisma.PrismaClientKnownRequestError): AppError => {
  switch (err.code) {
    case 'P2002': {
      const field = (err.meta?.target as string[])?.[0] || 'field';
      return new AppError(`Duplicate value for ${field}. Please use another value.`, 400);
    }
    case 'P2003':
      return new AppError('Foreign key constraint failed. Related record not found.', 400);
    case 'P2025':
      return new AppError('Record not found', 404);
    case 'P2000':
      return new AppError('Input value is too long for the field', 400);
    default:
      return new AppError('Database error occurred', 500);
  }
};

const handleJWTError = (): AppError => new AppError('Invalid token. Please log in again.', 401);
const handleJWTExpiredError = (): AppError => new AppError('Your token has expired. Please log in again.', 401);

const sendErrorDev = (err: any, res: any): void => {
  logger.error(`ERROR: ${err.message}`, { stack: err.stack });

  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err: any, res: any): void => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    logger.error(`ERROR 💥: ${err.message}`, { stack: err.stack });
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong. Please try again later.',
    });
  }
};

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err } as any;
    error.message = err.message;

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      error = handlePrismaError(err);
    }

    if (err instanceof Prisma.PrismaClientValidationError) {
      error = new AppError('Invalid data provided', 400);
    }

    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

export default errorHandler;
