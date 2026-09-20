import { Router } from 'express';
import { tenantMiddleware, requireRole, requireModule } from '../../core/tenancy/tenant.middleware';
import { listReturns, processReturn } from './return.controller';

const router = Router();

router.use(tenantMiddleware);
router.use(requireModule('returns'));

router.get('/', listReturns);
router.post('/', requireRole(['admin', 'manager', 'cashier']), processReturn);

export default router;
