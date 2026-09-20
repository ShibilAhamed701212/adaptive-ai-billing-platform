import { Router } from 'express';
import { tenantMiddleware } from '../../core/tenancy/tenant.middleware';
import { posCheckout } from './pos.controller';
import { listHeldBills, holdBill, restoreHeldBill, deleteHeldBill } from './held-bills.controller';

const router = Router();

router.use(tenantMiddleware);

router.post('/checkout', posCheckout);
router.get('/held-bills', listHeldBills);
router.post('/held-bills', holdBill);
router.post('/held-bills/:id/restore', restoreHeldBill);
router.delete('/held-bills/:id', deleteHeldBill);

export default router;
