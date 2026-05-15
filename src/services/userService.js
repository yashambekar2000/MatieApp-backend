const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const database = require('../configs/database');
const AppError = require('../utils/AppError');
const logger = require('../configs/logger');

class UserService {
  static async create(userData) {
    const prisma = database.getPrisma();
    
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
    });
    
    if (existingUser) {
      throw new AppError('Email already registered', 400);
    }
    
    const hashedPassword = await bcrypt.hash(
      userData.password,
      parseInt(process.env.BCRYPT_ROUNDS)
    );
    
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        role: userData.role || 'user',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
      },
    });
    
    logger.info(`User created: ${user.email}`);
    return user;
  }

  static async findByEmail(email) {
    const prisma = database.getPrisma();
    return await prisma.user.findUnique({
      where: { email },
    });
  }

  static async findById(id, includePassword = false) {
    const prisma = database.getPrisma();
    
    const selectFields = {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      emailVerified: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
    };
    
    if (includePassword) {
      selectFields.password = true;
      selectFields.passwordChangedAt = true;
    }
    
    return await prisma.user.findUnique({
      where: { id },
      select: selectFields,
    });
  }

  static async updateUser(id, data) {
    const prisma = database.getPrisma();
    
    const updateData = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(
        data.password,
        parseInt(process.env.BCRYPT_ROUNDS)
      );
      updateData.passwordChangedAt = new Date();
    }
    
    return await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        emailVerified: true,
        updatedAt: true,
      },
    });
  }

  static async updateLastLogin(id) {
    const prisma = database.getPrisma();
    return await prisma.user.update({
      where: { id },
      data: { lastLogin: new Date() },
    });
  }

  static async setPasswordResetToken(email) {
    const prisma = database.getPrisma();
    
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    await prisma.user.update({
      where: { email },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });
    
    return resetToken;
  }

  static async resetPassword(token, newPassword) {
    const prisma = database.getPrisma();
    
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { gt: new Date() },
      },
    });
    
    if (!user) {
      throw new AppError('Token is invalid or has expired', 400);
    }
    
    const hashedPassword = await bcrypt.hash(
      newPassword,
      parseInt(process.env.BCRYPT_ROUNDS)
    );
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        passwordChangedAt: new Date(),
      },
    });
    
    return user;
  }

  static async getAllUsers(filters = {}, pagination = {}) {
    const prisma = database.getPrisma();
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    
    const where = {};
    if (filters.role) where.role = filters.role;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.email) where.email = { contains: filters.email, mode: 'insensitive' };
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          emailVerified: true,
          lastLogin: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);
    
    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  static async deleteUser(id) {
    const prisma = database.getPrisma();
    
    // Delete related sessions first (cascade should handle but explicit for safety)
    await prisma.session.deleteMany({ where: { userId: id } });
    
    return await prisma.user.delete({ where: { id } });
  }
}

module.exports = UserService;