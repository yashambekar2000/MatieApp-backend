const logger = require('../configs/logger');
const AppError = require('../utils/AppError');
const { Prisma } = require('@prisma/client');

// Handle Prisma specific errors
const handlePrismaError = (err) => {
  switch (err.code) {
    case 'P2002':
      const field = err.meta?.target?.[0] || 'field';
      return new AppError(`Duplicate value for ${field}. Please use another value.`, 400);
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

const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401);
const handleJWTExpiredError = () => new AppError('Your token has expired. Please log in again.', 401);

const sendErrorDev = (err, res) => {
  logger.error(`ERROR: ${err.message}`, { stack: err.stack });
  
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  // Operational, trusted errors
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Programming or unknown errors
    logger.error(`ERROR 💥: ${err.message}`, { stack: err.stack });
    
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong. Please try again later.',
    });
  }
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;
    
    // Handle Prisma errors
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