import { Router } from 'express';
import * as authController from '../controllers/authController';
import { protect } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validationMiddleware';
import {
  registerValidation,
  loginValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} from '../validations/authValidations';

const router = Router();

router.post('/register', registerValidation, validate, authController.register);
router.post('/login', loginValidation, validate, authController.login);
router.post('/logout', protect, authController.logout);
router.patch('/change-password', protect, changePasswordValidation, validate, authController.changePassword);
router.post('/forgot-password', forgotPasswordValidation, validate, authController.forgotPassword);
router.patch('/reset-password/:token', resetPasswordValidation, validate, authController.resetPassword);
router.get('/me', protect, authController.getMe);
router.get('/sessions', protect, authController.getSessions);
router.delete('/sessions/:sessionId', protect, authController.invalidateSession);

export default router;
