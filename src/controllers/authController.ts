import { NextFunction, Request, Response } from 'express';
import AuthService from '../services/authService';
import catchAsync from '../utils/catchAsync';
import AppError from '../utils/AppError';

export const register = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = await AuthService.register(req.body, req);
  await AuthService.createSendToken(user, 201, res, req);
});

export const updateLocation = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = await AuthService.updateLocation(req.user!.id, req.body);
  res.status(200).json({
    status: 'success',
    message: 'Location updated successfully',
    data: { user }
  });
});

export const login = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  const user = await AuthService.login(email, password, req);
  await AuthService.createSendToken(user, 200, res, req);
});

export const logout = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  await AuthService.logout(req.token || '', req.user?.id || '', req);

  res.clearCookie('jwt');
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully',
  });
});

export const changePassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new AppError('Please provide current password and new password', 400));
  }

  await AuthService.changePassword(req.user!.id, currentPassword, newPassword, req);

  res.status(200).json({
    status: 'success',
    message: 'Password changed successfully. Please login again.',
  });
});

export const forgotPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
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

export const resetPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password) {
    return next(new AppError('Please provide new password', 400));
  }

  await AuthService.resetPassword(token, password, req);

  res.status(200).json({
    status: 'success',
    message: 'Password reset successfully. Please login with your new password.',
  });
});

export const getMe = catchAsync(async (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    data: { user: req.user },
  });
});

export const getSessions = catchAsync(async (req: Request, res: Response) => {
  const sessions = await AuthService.getUserSessions(req.user!.id);

  res.status(200).json({
    status: 'success',
    data: { sessions },
  });
});

export const invalidateSession = catchAsync(async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  await AuthService.invalidateSession(sessionId);

  res.status(200).json({
    status: 'success',
    message: 'Session invalidated successfully',
  });
});

export default {
  register,
  login,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
  getMe,
  getSessions,
  invalidateSession,
};
