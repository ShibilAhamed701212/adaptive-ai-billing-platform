import { Router } from 'express';
import { listPayments, recordPayment, refundPayment, testCheckout } from './payment.controller';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';
import { validate } from '../../core/middleware/validate.middleware';
import { recordPaymentSchema, refundPaymentSchema } from '../../core/schemas/payment.schema';

const router = Router();

router.use(tenantMiddleware);

router.get('/', listPayments);
router.post('/', requireRole(['admin', 'manager', 'accountant']), validate(recordPaymentSchema), recordPayment);
router.post('/:id/refund', requireRole(['admin', 'manager']), validate(refundPaymentSchema), refundPayment);
router.post('/test-checkout', requireRole(['admin']), testCheckout);

export default router;
