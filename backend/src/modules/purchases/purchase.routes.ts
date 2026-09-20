import { Router } from 'express';
import { tenantMiddleware, requireRole, requireModule } from '../../core/tenancy/tenant.middleware';
import { listPurchases, createPurchase } from './purchase.controller';

const router = Router();

router.use(tenantMiddleware);
router.use(requireModule('purchases'));

router.get('/', listPurchases);
router.post('/', requireRole(['admin', 'manager', 'accountant']), createPurchase);

export default router;
