import { Router } from 'express';
import { register, login, getMe } from './auth.controller';
import { tenantMiddleware } from '../../core/tenancy/tenant.middleware';
import { validate } from '../../core/middleware/validate.middleware';
import { registerSchema, loginSchema } from '../../core/schemas/auth.schema';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', tenantMiddleware, getMe);

export default router;
