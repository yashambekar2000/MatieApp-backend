const AuthService = require('../services/authService');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

exports.protect = catchAsync(async (req, res, next) => {
  let token;
  
  // Get token from header or cookie
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.jwt) {
    token = req.cookies.jwt;
  }
  
  if (!token) {
    return next(new AppError('You are not logged in. Please log in to access this resource.', 401));
  }
  
  // Validate token
  const result = await AuthService.validateToken(token);
  if (!result) {
    return next(new AppError('Invalid or expired token. Please log in again.', 401));
  }
  
  req.user = result.user;
  req.session = result.session;
  req.token = token;
  
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

// Optional auth - doesn't throw error if no token
exports.optionalAuth = catchAsync(async (req, res, next) => {
  let token;
  
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