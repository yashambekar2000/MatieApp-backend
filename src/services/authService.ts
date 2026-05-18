import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import jwt, { Secret } from 'jsonwebtoken';
import { Session, User } from '@prisma/client';

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
  static signToken(id: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new AppError('JWT secret is not configured', 500);
    }

    return jwt.sign({ id }, secret as Secret, {
      expiresIn: process.env.JWT_EXPIRES_IN ?? '90d',
    } as any);
  }

  static async createSendToken(user: { id: string }, statusCode: number, res: Response, req: Request): Promise<void> {
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
      userId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.status(statusCode).json({
      status: 'success',
      token,
      data: { user },
    });
  }

  static async register(userData: Record<string, unknown>, req: Request): Promise<Pick<User, 'id' | 'email' | 'name' | 'role' | 'isActive' | 'emailVerified' | 'createdAt'>> {
    const user = await UserService.create(userData as { email: string; password: string; name: string; role?: Role });

    await AuditLogService.log({
      userId: user.id,
      action: 'REGISTER',
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    return user;
  }

  static async login(email: string, password: string, req: Request): Promise<Omit<User, 'password'>> {
    const user = await UserService.findByEmail(email);

    if (!user || !(await bcrypt.compare(password, (user as UserWithPassword).password))) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.isActive) {
      throw new AppError('Account is deactivated. Please contact support.', 401);
    }

    await UserService.updateLastLogin(user.id);

    const { password: _password, ...userWithoutPassword } = user as UserWithPassword;
    return userWithoutPassword;
  }

  static async logout(token: string, userId: string, req: Request): Promise<void> {
    await SessionService.invalidateSession(token);

    await AuditLogService.log({
      userId,
      action: 'LOGOUT',
      entity: 'User',
      entityId: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    logger.info(`User logged out: ${userId}`);
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string, req: Request): Promise<User | null> {
    const user = (await UserService.findById(userId, true)) as UserWithPassword | null;

    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new AppError('Current password is incorrect', 401);
    }

    await UserService.updateUser(userId, { password: newPassword });
    await SessionService.invalidateAllUserSessions(userId, req.token || undefined);

    await AuditLogService.log({
      userId,
      action: 'CHANGE_PASSWORD',
      entity: 'User',
      entityId: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
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
        userId: user.id,
        action: 'FORGOT_PASSWORD',
        entity: 'User',
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
      });
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Error sending password reset email: ${error.message}`);
      }
      throw new AppError('Error sending email. Please try again later.', 500);
    }
  }

  static async resetPassword(token: string, newPassword: string, req: Request): Promise<User> {
    const user = await UserService.resetPassword(token, newPassword);
    await SessionService.invalidateAllUserSessions(user.id);

    await AuditLogService.log({
      userId: user.id,
      action: 'RESET_PASSWORD',
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    return user;
  }

  static async validateToken(token: string): Promise<{ user: User; session: Session } | null> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as AuthTokenPayload;
      const session = await SessionService.findSessionByToken(token);

      if (!session || session.expiresAt < new Date()) {
        return null;
      }

      const user = await UserService.findById(decoded.id);
      if (!user || !user.isActive) {
        return null;
      }

      if (user.passwordChangedAt) {
        const changedTimestamp = Math.floor(user.passwordChangedAt.getTime() / 1000);
        if (changedTimestamp > decoded.iat) {
          return null;
        }
      }

      return { user, session };
    } catch {
      return null;
    }
  }

  static async getUserSessions(userId: string) {
    return SessionService.getUserSessions(userId);
  }

  static async invalidateSession(sessionId: string) {
    return SessionService.invalidateSession(sessionId);
  }
}

export default AuthService;
