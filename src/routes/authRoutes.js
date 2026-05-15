const express = require('express');
const authController = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validationMiddleware');

const router = express.Router();
const {
  registerValidation,
  loginValidation,
    changePasswordValidation,
    forgotPasswordValidation,
    resetPasswordValidation,
} = require('../validations/authValidations');

router.post('/register', registerValidation, validate, authController.register);
router.post('/login', loginValidation, validate, authController.login);
router.post('/logout', protect, authController.logout);
router.patch('/change-password', protect, changePasswordValidation, validate, authController.changePassword);
router.post('/forgot-password', forgotPasswordValidation, validate, authController.forgotPassword);
router.patch('/reset-password/:token', resetPasswordValidation, validate, authController.resetPassword);
router.get('/me', protect, authController.getMe);
router.get('/sessions', protect, authController.getSessions);
router.delete('/sessions/:sessionId', protect, authController.invalidateSession);

module.exports = router;