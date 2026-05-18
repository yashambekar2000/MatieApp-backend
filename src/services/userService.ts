import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { UpdateUserData, User, UserRequest, UserResponse } from '../types/auth';
import database from '../configs/database';
import AppError from '../utils/AppError';
import logger from '../configs/logger';

class UserService {
  static async create(userData: UserRequest): Promise<UserResponse> {
    const prisma = database.getPrisma();

    const existingUser = await prisma.user.findFirst({ where: { phone_number: userData.phone_number } });
    if (existingUser) {
      throw new AppError('Phone number already registered', 400);
    }

    const hashedPassword = await bcrypt.hash(userData.password, parseInt(process.env.BCRYPT_ROUNDS || '12', 10));

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        password: hashedPassword,
        first_name: userData.first_name,
        last_name: userData.last_name,
        firm_name: userData.firm_name,
        location_latitude: userData.location_latitude,
        location_longitude: userData.location_longitude,
        address_string: userData.address_string,
        role: { connect: { id: userData.role_id ?? 1 } },
        phone_number: userData.phone_number,
      } as Prisma.UserCreateInput,
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role_id: true,
        is_active: true,
        email_verified: true,
        created_at: true,
      } as Prisma.UserSelect,
    });

    logger.info(`User created: ${user.email}`);
    return user;
  }

  static async findByEmail(email: string): Promise<UserResponse | null> {
    const prisma = database.getPrisma();
    return prisma.user.findUnique({ where: { email } });
  }

  static async findById(id: number, includePassword = false): Promise<(User & { password?: string; password_changed_at?: Date | null }) | null> {
    const prisma = database.getPrisma();

    const selectFields: Prisma.UserSelect = {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      role_id: true,
      is_active: true,
      email_verified: true,
      last_login: true,
      created_at: true,
      updated_at: true,
    };

    if (includePassword) {
      selectFields.password = true;
      selectFields.password_changed_at = true;
    }

    return prisma.user.findUnique({
      where: { id },
      select: selectFields,
    });
  }

  static async updateUser(id: number, data: UpdateUserData): Promise<UserResponse> {
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
        first_name: true,
        last_name: true,
        role_id: true,
        location_latitude: true,
        location_longitude: true,
        address_string: true,
        is_active: true,
        email_verified: true,
        updated_at: true,
      },
    });
  }

  static async updateLastLogin(id: number | undefined): Promise<UserResponse> {
    const prisma = database.getPrisma();
    return prisma.user.update({ where: { id }, data: { last_login: new Date() } });
  }

  static async setPasswordResetToken(email: string): Promise<string> {
    const prisma = database.getPrisma();
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    await prisma.user.update({
      where: { email },
      data: {
        password_reset_token: hashedToken,
        password_reset_expires: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    return resetToken;
  }

  static async resetPassword(token: string, newPassword: string): Promise<UserResponse> {
    const prisma = database.getPrisma();
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        password_reset_token: hashedToken,
        password_reset_expires: { gt: new Date() },
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
        password_reset_token: null,
        password_reset_expires: null,
        password_changed_at: new Date(),
      },
    });

    return user;
  }

  static async getAllUsers(filters: { role?: number; isActive?: boolean; email?: string } = {}, pagination: { page?: number; limit?: number } = {}) {
    const prisma = database.getPrisma();
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {};

    if (filters.role) where.role_id = filters.role;
    if (filters.isActive !== undefined) where.is_active = filters.isActive;
    if (filters.email) where.email = { contains: filters.email, mode: 'insensitive' };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          role_id: true,
          isActive: true,
          emailVerified: true,
          lastLogin: true,
          createdAt: true,
        },
        orderBy: { created_at: 'desc' },
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

  static async deleteUser(id: number): Promise<UserResponse> {
    const prisma = database.getPrisma();
    await prisma.session.deleteMany({ where: { user_id: id } });
    return prisma.user.delete({ where: { id } });
  }
}

export default UserService;
