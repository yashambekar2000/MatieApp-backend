const express = require('express');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const UserService = require('../services/userService');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { body } = require('express-validator');
const { validate } = require('../middlewares/validationMiddleware');
const AuditLogService = require('../services/auditLogService');

const router = express.Router();

// Get all users (admin only)
router.get('/', 
  protect, 
  restrictTo('admin', 'super_admin'),
  catchAsync(async (req, res, next) => {
    const { page = 1, limit = 10, role, isActive, email } = req.query;
    
    const result = await UserService.getAllUsers(
      { role, isActive, email },
      { page: parseInt(page), limit: parseInt(limit) }
    );
    
    res.status(200).json({
      status: 'success',
      data: result,
    });
  })
);

// Get current user profile
router.get('/me',
  protect,
  catchAsync(async (req, res, next) => {
    const user = await UserService.findById(req.user.id);
    res.status(200).json({
      status: 'success',
      data: { user },
    });
  })
);

// Update current user
router.patch('/me',
  protect,
  [
    body('name').optional().trim().isLength({ min: 2, max: 50 }),
  ],
  validate,
  catchAsync(async (req, res, next) => {
    const allowedFields = ['name'];
    const updates = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    });
    
    const user = await UserService.updateUser(req.user.id, updates);
    
    // Audit log
    await AuditLogService.log({
      userId: req.user.id,
      action: 'UPDATE_PROFILE',
      entity: 'User',
      entityId: req.user.id,
      newValue: updates,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    res.status(200).json({
      status: 'success',
      data: { user },
    });
  })
);

// Get user by ID (admin only)
router.get('/:id',
  protect,
  restrictTo('admin', 'super_admin'),
  catchAsync(async (req, res, next) => {
    const user = await UserService.findById(req.params.id);
    
    if (!user) {
      return next(new AppError('No user found with that ID', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: { user },
    });
  })
);

// Update user (admin only)
router.patch('/:id',
  protect,
  restrictTo('admin', 'super_admin'),
  [
    body('name').optional().trim(),
    body('role').optional().isIn(['user', 'admin', 'super_admin']),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  catchAsync(async (req, res, next) => {
    const user = await UserService.updateUser(req.params.id, req.body);
    
    // Audit log
    await AuditLogService.log({
      userId: req.user.id,
      action: 'UPDATE_USER',
      entity: 'User',
      entityId: req.params.id,
      oldValue: { id: req.params.id },
      newValue: req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    res.status(200).json({
      status: 'success',
      data: { user },
    });
  })
);

// Delete user (admin only)
router.delete('/:id',
  protect,
  restrictTo('admin', 'super_admin'),
  catchAsync(async (req, res, next) => {
    const user = await UserService.findById(req.params.id);
    
    if (!user) {
      return next(new AppError('No user found with that ID', 404));
    }
    
    await UserService.deleteUser(req.params.id);
    
    // Audit log
    await AuditLogService.log({
      userId: req.user.id,
      action: 'DELETE_USER',
      entity: 'User',
      entityId: req.params.id,
      oldValue: user,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    res.status(204).json({
      status: 'success',
      data: null,
    });
  })
);

// Get user activity logs (admin only)
router.get('/:id/activities',
  protect,
  restrictTo('admin', 'super_admin'),
  catchAsync(async (req, res, next) => {
    const { limit = 50, offset = 0 } = req.query;
    
    const activities = await AuditLogService.getUserActivity(
      req.params.id,
      parseInt(limit),
      parseInt(offset)
    );
    
    res.status(200).json({
      status: 'success',
      data: { activities },
    });
  })
);

module.exports = router;