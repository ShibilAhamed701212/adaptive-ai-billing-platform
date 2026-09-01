import { Router } from 'express';
import { listUsers, createUser, updateUser } from './user.controller';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';

const router = Router();

router.use(tenantMiddleware);

router.get('/', listUsers);
router.post('/', requireRole(['admin']), createUser);
router.patch('/:id', requireRole(['admin']), updateUser);

export default router;
