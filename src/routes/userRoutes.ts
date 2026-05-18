import { Router } from 'express';
import { body } from 'express-validator';
import { protect, restrictTo } from '../middlewares/authMiddleware';
import catchAsync from '../utils/catchAsync';
import AppError from '../utils/AppError';
import UserService from '../services/userService';
import AuditLogService from '../services/auditLogService';
import { validate } from '../middlewares/validationMiddleware';

type Role = 'user' | 'admin' | 'super_admin';

const router = Router();

router.get(
  '/',
  protect,
  restrictTo('admin', 'super_admin'),
  catchAsync(async (req, res) => {
    const { page = '1', limit = '10', role, isActive, email } = req.query;
    const result = await UserService.getAllUsers(
      { role: role as Role | undefined, isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined, email: email as string },
      { page: parseInt(page as string, 10), limit: parseInt(limit as string, 10) },
    );

    res.status(200).json({ status: 'success', data: result });
  }),
);

router.get(
  '/me',
  protect,
  catchAsync(async (req, res) => {
    const user = await UserService.findById(req.user!.id);
    res.status(200).json({ status: 'success', data: { user } });
  }),
);

router.patch(
  '/me',
  protect,
  [body('name').optional().trim().isLength({ min: 2, max: 50 })],
  validate,
  catchAsync(async (req, res) => {
    const allowedFields = ['name'];
    const updates: Record<string, unknown> = {};

    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const user = await UserService.updateUser(req.user!.id, updates as any);

    await AuditLogService.log({
      userId: req.user!.id,
      action: 'UPDATE_PROFILE',
      entity: 'User',
      entityId: req.user!.id,
      newValue: updates,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.status(200).json({ status: 'success', data: { user } });
  }),
);

router.get(
  '/:id',
  protect,
  restrictTo('admin', 'super_admin'),
  catchAsync(async (req, res, next) => {
    const user = await UserService.findById(req.params.id);
    if (!user) {
      return next(new AppError('No user found with that ID', 404));
    }
    res.status(200).json({ status: 'success', data: { user } });
  }),
);

router.patch(
  '/:id',
  protect,
  restrictTo('admin', 'super_admin'),
  [
    body('name').optional().trim(),
    body('role').optional().isIn(['user', 'admin', 'super_admin']),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  catchAsync(async (req, res) => {
    const user = await UserService.updateUser(req.params.id, req.body as any);

    await AuditLogService.log({
      userId: req.user!.id,
      action: 'UPDATE_USER',
      entity: 'User',
      entityId: req.params.id,
      oldValue: { id: req.params.id },
      newValue: req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.status(200).json({ status: 'success', data: { user } });
  }),
);

router.delete(
  '/:id',
  protect,
  restrictTo('admin', 'super_admin'),
  catchAsync(async (req, res, next) => {
    const user = await UserService.findById(req.params.id);
    if (!user) {
      return next(new AppError('No user found with that ID', 404));
    }

    await UserService.deleteUser(req.params.id);

    await AuditLogService.log({
      userId: req.user!.id,
      action: 'DELETE_USER',
      entity: 'User',
      entityId: req.params.id,
      oldValue: user,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.status(204).json({ status: 'success', data: null });
  }),
);

router.get(
  '/:id/activities',
  protect,
  restrictTo('admin', 'super_admin'),
  catchAsync(async (req, res) => {
    const { limit = '50', offset = '0' } = req.query;
    const activities = await AuditLogService.getUserActivity(req.params.id, parseInt(limit as string, 10), parseInt(offset as string, 10));
    res.status(200).json({ status: 'success', data: { activities } });
  }),
);

export default router;
