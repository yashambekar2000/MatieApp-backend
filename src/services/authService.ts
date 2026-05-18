import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import jwt, { Secret } from 'jsonwebtoken';
import { Session, User, UserRequest, UserResponse } from '../types/auth';

type Role = 'user' | 'admin' | 'super_admin';
import UserService from './userService';
import SessionService from './sessionService';
import AuditLogService from './auditLogService';
import AppError from '../utils/AppError';
import logger from '../configs/logger';
import emailService from './emailService';

type UserWithPassword = User & {
  password: string;
  passwordChangedAt: Date | null;
};

export type AuthTokenPayload = {
  id: string;
  iat: number;
  exp: number;
};

class AuthService {
  static signToken(id: number): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new AppError('JWT secret is not configured', 500);
    }

    return jwt.sign({ id }, secret as Secret, {
      expiresIn: process.env.JWT_EXPIRES_IN ?? '90d',
    } as any);
  }

  static async createSendToken(user: { id: number }, statusCode: number, res: Response, req: Request): Promise<void> {
    const token = this.signToken(user.id);
    const expiresIn = parseInt(process.env.JWT_COOKIE_EXPIRES_IN || '90', 10) * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + expiresIn);

    await SessionService.createSession(
      user.id,
      token,
      expiresAt,
      req.get('user-agent') || null,
      req.ip || null,
    );

    const cookieOptions = {
      expires: expiresAt,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
    };

    res.cookie('jwt', token, cookieOptions);

    await AuditLogService.log({
      user_id: user.id,
      action: 'LOGIN',
      entity: 'User',
      entity_id: user.id,
      ip_address: req.ip,
      user_agent: req.get('user-agent') || null,
    });

    res.status(statusCode).json({
      status: 'success',
      token,
      data: { user },
    });
  }

  static async register(userData: UserRequest, req: Request): Promise<UserResponse> {
    const user = await UserService.create(userData as UserRequest);

    await AuditLogService.log({
      user_id: user.id,
      action: 'REGISTER',
      entity: 'User',
      entity_id: user.id,
      ip_address: req.ip,
      user_agent: req.get('user-agent') || null,
    });

    return user;
  }

  static async updateLocation(userId: number, locationData: { location_latitude: number; location_longitude: number; address_string?: string }): Promise<UserResponse> {
    const user = await UserService.findById(userId);

    if (!user) {
      throw new AppError('User not found', 404);
    }
    const updatedUser = await UserService.updateUser(userId, locationData);
    logger.info(`User location updated: ${userId}`);
    return updatedUser;
  }

  static async login(email: string, password: string, req: Request): Promise<Omit<UserResponse, 'password'>> {
    const user = await UserService.findByEmail(email);

    if (!user || !(await bcrypt.compare(password, (user as UserWithPassword).password))) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.is_active) {
      throw new AppError('Account is deactivated. Please contact support.', 401);
    }

    await UserService.updateLastLogin(user.id);

    const { password: _password, ...userWithoutPassword } = user as UserWithPassword;
    return userWithoutPassword;
  }

  static async logout(token: string, userId: number, req: Request): Promise<void> {
    await SessionService.invalidateSession(token);

    await AuditLogService.log({
      user_id: userId,
      action: 'LOGOUT',
      entity: 'User',
      entity_id: userId,
      ip_address: req.ip,
      user_agent: req.get('user-agent') || null,
    });

    logger.info(`User logged out: ${userId}`);
  }

  static async changePassword(userId: number, currentPassword: string, newPassword: string, req: Request): Promise<User | null> {
    const user = (await UserService.findById(userId, true)) as UserWithPassword | null;

    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new AppError('Current password is incorrect', 401);
    }

    await UserService.updateUser(userId, { password: newPassword });
    await SessionService.invalidateAllUserSessions(userId, req.token || undefined);

    await AuditLogService.log({
      user_id: userId,
      action: 'CHANGE_PASSWORD',
      entity: 'User',
      entity_id: userId,
      ip_address: req.ip,
      user_agent: req.get('user-agent') || null,
    });

    logger.info(`Password changed for user: ${userId}`);
    return user;
  }

  static async forgotPassword(email: string, req: Request): Promise<void> {
    const user = await UserService.findByEmail(email);
    if (!user) {
      throw new AppError('No user found with that email', 404);
    }

    const resetToken = await UserService.setPasswordResetToken(email);

    try {
      await emailService.sendPasswordResetEmail(email, resetToken);
      logger.info(`Password reset email sent to: ${email}`);

      await AuditLogService.log({
        user_id: user.id,
        action: 'FORGOT_PASSWORD',
        entity: 'User',
        entity_id: user.id,
        ip_address: req.ip,
        user_agent: req.get('user-agent') || null,
      });
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Error sending password reset email: ${error.message}`);
      }
      throw new AppError('Error sending email. Please try again later.', 500);
    }
  }

  static async resetPassword(token: string, newPassword: string, req: Request): Promise<UserResponse> {
    const user = await UserService.resetPassword(token, newPassword);
    await SessionService.invalidateAllUserSessions(user.id);

    await AuditLogService.log({
      user_id: user.id,
      action: 'RESET_PASSWORD',
      entity: 'User',
      entity_id: user.id,
      ip_address: req.ip,
      user_agent: req.get('user-agent') || null,
    });

    return user;
  }

  static async validateToken(token: string): Promise<{ user: User; session: Session } | null> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as AuthTokenPayload;
      const session = await SessionService.findSessionByToken(token);

      if (!session || session.expires_at < new Date()) {
        return null;
      }

      const user = await UserService.findById(parseInt(decoded.id));
      if (!user || !user.is_active) {
        return null;
      }

      if (user.password_changed_at) {
        const changedTimestamp = Math.floor(user.password_changed_at.getTime() / 1000);
        if (changedTimestamp > decoded.iat) {
          return null;
        }
      }

      return { user, session };
    } catch {
      return null;
    }
  }

  static async getUserSessions(userId: number) {
    return SessionService.getUserSessions(userId);
  }

  static async invalidateSession(sessionId: string) {
    return SessionService.invalidateSession(sessionId);
  }
}

export default AuthService;
