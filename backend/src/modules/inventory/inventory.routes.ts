import { Router } from 'express';
import { tenantMiddleware, requireRole, requireModule } from '../../core/tenancy/tenant.middleware';
import {
  listMovements,
  adjustStock,
  getLowStockAlerts,
  getStockValuation,
} from './inventory.controller';

const router = Router();

router.use(tenantMiddleware);
router.use(requireModule('inventory'));

router.get('/movements', listMovements);
router.get('/low-stock', getLowStockAlerts);
router.get('/valuation', getStockValuation);
router.post('/adjustments', requireRole(['admin', 'manager', 'cashier']), adjustStock);
router.post('/adjust', requireRole(['admin', 'manager', 'cashier']), adjustStock);

export default router;
