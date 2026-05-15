const AuthService = require('../services/authService');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const SessionService = require('../services/sessionService');

exports.register = catchAsync(async (req, res, next) => {
  const user = await AuthService.register(req.body, req);
  AuthService.createSendToken(user, 201, res, req);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }
  
  const user = await AuthService.login(email, password, req);
  AuthService.createSendToken(user, 200, res, req);
});

exports.logout = catchAsync(async (req, res, next) => {
  await AuthService.logout(req.token, req.user.id, req);
  
  res.clearCookie('jwt');
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully',
  });
});

exports.changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return next(new AppError('Please provide current password and new password', 400));
  }
  
  const user = await AuthService.changePassword(
    req.user.id,
    currentPassword,
    newPassword,
    req
  );
  
  res.status(200).json({
    status: 'success',
    message: 'Password changed successfully. Please login again.',
  });
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return next(new AppError('Please provide email address', 400));
  }
  
  await AuthService.forgotPassword(email, req);
  
  res.status(200).json({
    status: 'success',
    message: 'Password reset token sent to email',
  });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const { token } = req.params;
  const { password } = req.body;
  
  if (!password) {
    return next(new AppError('Please provide new password', 400));
  }
  
  const user = await AuthService.resetPassword(token, password, req);
  
  res.status(200).json({
    status: 'success',
    message: 'Password reset successfully. Please login with your new password.',
  });
});

exports.getMe = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: 'success',
    data: { user: req.user },
  });
});

exports.getSessions = catchAsync(async (req, res, next) => {
  const sessions = await SessionService.getUserSessions(req.user.id);
  
  res.status(200).json({
    status: 'success',
    data: { sessions },
  });
});

exports.invalidateSession = catchAsync(async (req, res, next) => {
  const { sessionId } = req.params;
  
  await SessionService.invalidateSession(sessionId);
  
  res.status(200).json({
    status: 'success',
    message: 'Session invalidated successfully',
  });
});