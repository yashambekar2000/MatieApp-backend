import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Prisma, User } from '@prisma/client';
import database from '../configs/database';
import AppError from '../utils/AppError';
import logger from '../configs/logger';

type Role = 'user' | 'admin' | 'super_admin';

type NewUserData = {
  email: string;
  password: string;
  name: string;
  role?: Role;
};

type UpdateUserData = Partial<{
  name: string;
  role: Role;
  isActive: boolean;
  password: string;
  emailVerified: boolean;
  passwordChangedAt: Date;
}>;

class UserService {
  static async create(userData: NewUserData): Promise<Pick<User, 'id' | 'email' | 'name' | 'role' | 'isActive' | 'emailVerified' | 'createdAt'>> {
    const prisma = database.getPrisma();

    const existingUser = await prisma.user.findUnique({ where: { email: userData.email } });
    if (existingUser) {
      throw new AppError('Email already registered', 400);
    }

    const hashedPassword = await bcrypt.hash(userData.password, parseInt(process.env.BCRYPT_ROUNDS || '12', 10));

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        role: userData.role ?? 'user',
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

  static async findByEmail(email: string): Promise<User | null> {
    const prisma = database.getPrisma();
    return prisma.user.findUnique({ where: { email } });
  }

  static async findById(id: string, includePassword = false): Promise<(User & { password?: string; passwordChangedAt?: Date | null }) | null> {
    const prisma = database.getPrisma();

    const selectFields: Prisma.UserSelect = {
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

    return prisma.user.findUnique({
      where: { id },
      select: selectFields,
    });
  }

  static async updateUser(id: string, data: UpdateUserData): Promise<Pick<User, 'id' | 'email' | 'name' | 'role' | 'isActive' | 'emailVerified' | 'updatedAt'>> {
    const prisma = database.getPrisma();

    const updateData: any = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, parseInt(process.env.BCRYPT_ROUNDS || '12', 10));
      updateData.passwordChangedAt = new Date();
    }

    return prisma.user.update({
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

  static async updateLastLogin(id: string): Promise<User> {
    const prisma = database.getPrisma();
    return prisma.user.update({ where: { id }, data: { lastLogin: new Date() } });
  }

  static async setPasswordResetToken(email: string): Promise<string> {
    const prisma = database.getPrisma();
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    await prisma.user.update({
      where: { email },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    return resetToken;
  }

  static async resetPassword(token: string, newPassword: string): Promise<User> {
    const prisma = database.getPrisma();
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new AppError('Token is invalid or has expired', 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS || '12', 10));

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

  static async getAllUsers(filters: { role?: Role; isActive?: boolean; email?: string } = {}, pagination: { page?: number; limit?: number } = {}) {
    const prisma = database.getPrisma();
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {};

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

  static async deleteUser(id: string): Promise<User> {
    const prisma = database.getPrisma();
    await prisma.session.deleteMany({ where: { userId: id } });
    return prisma.user.delete({ where: { id } });
  }
}

export default UserService;
