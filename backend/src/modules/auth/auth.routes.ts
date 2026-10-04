import { Router } from 'express';
import { register, login, getMe, logout, forgotPassword, resetPassword } from './auth.controller';
import { tenantMiddleware } from '../../core/tenancy/tenant.middleware';
import { validate } from '../../core/middleware/validate.middleware';
import { authRateLimiter } from '../../core/middleware/rate-limiter.middleware';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../../core/schemas/auth.schema';

const router = Router();

router.post('/register', authRateLimiter, validate(registerSchema), register);
router.post('/login', authRateLimiter, validate(loginSchema), login);
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), resetPassword);
router.get('/me', tenantMiddleware, getMe);
router.post('/logout', logout);

export default router;
