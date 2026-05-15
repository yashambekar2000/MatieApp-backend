const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const UserService = require('./userService');
const SessionService = require('./sessionService');
const AuditLogService = require('./auditLogService');
const AppError = require('../utils/AppError');
const logger = require('../configs/logger');
const emailService = require('./emailService');

class AuthService {
  static signToken(id) {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });
  }

  static async createSendToken(user, statusCode, res, req) {
    const token = this.signToken(user.id);
    
    // Calculate expiry
    const expiresIn = parseInt(process.env.JWT_COOKIE_EXPIRES_IN) * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + expiresIn);
    
    // Create session
    await SessionService.createSession(
      user.id,
      token,
      expiresAt,
      req.get('user-agent'),
      req.ip
    );
    
    // Cookie options
    const cookieOptions = {
      expires: expiresAt,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    };
    
    res.cookie('jwt', token, cookieOptions);
    
    // Audit log
    await AuditLogService.log({
      userId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    res.status(statusCode).json({
      status: 'success',
      token,
      data: { user },
    });
  }

  static async register(userData, req) {
    const user = await UserService.create(userData);
    
    // Audit log
    await AuditLogService.log({
      userId: user.id,
      action: 'REGISTER',
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    return user;
  }

  static async login(email, password, req) {
    const user = await UserService.findByEmail(email);
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppError('Invalid email or password', 401);
    }
    
    if (!user.isActive) {
      throw new AppError('Account is deactivated. Please contact support.', 401);
    }
    
    // Update last login
    await UserService.updateLastLogin(user.id);
    
    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user;
    
    return userWithoutPassword;
  }

  static async logout(token, userId, req) {
    // Invalidate session
    await SessionService.invalidateSession(token);
    
    // Audit log
    await AuditLogService.log({
      userId,
      action: 'LOGOUT',
      entity: 'User',
      entityId: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    logger.info(`User logged out: ${userId}`);
  }

  static async changePassword(userId, currentPassword, newPassword, req) {
    const user = await UserService.findById(userId, true);
    
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new AppError('Current password is incorrect', 401);
    }
    
    await UserService.updateUser(userId, { password: newPassword });
    
    // Invalidate all other sessions
    await SessionService.invalidateAllUserSessions(userId, req.token);
    
    // Audit log
    await AuditLogService.log({
      userId,
      action: 'CHANGE_PASSWORD',
      entity: 'User',
      entityId: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    logger.info(`Password changed for user: ${userId}`);
    return user;
  }

  static async forgotPassword(email, req) {
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
        userAgent: req.get('user-agent'),
      });
    } catch (error) {
      logger.error(`Error sending password reset email: ${error.message}`);
      throw new AppError('Error sending email. Please try again later.', 500);
    }
  }

  static async resetPassword(token, newPassword, req) {
    const user = await UserService.resetPassword(token, newPassword);
    
    // Invalidate all sessions
    await SessionService.invalidateAllUserSessions(user.id);
    
    await AuditLogService.log({
      userId: user.id,
      action: 'RESET_PASSWORD',
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    return user;
  }

  static async validateToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const session = await SessionService.findSessionByToken(token);
      
      if (!session || session.expiresAt < new Date()) {
        return null;
      }
      
      const user = await UserService.findById(decoded.id);
      if (!user || !user.isActive) {
        return null;
      }
      
      // Check if password changed after token was issued
      if (user.passwordChangedAt) {
        const changedTimestamp = parseInt(user.passwordChangedAt.getTime() / 1000);
        if (changedTimestamp > decoded.iat) {
          return null;
        }
      }
      
      return { user, session };
    } catch (error) {
      return null;
    }
  }
}

module.exports = AuthService;