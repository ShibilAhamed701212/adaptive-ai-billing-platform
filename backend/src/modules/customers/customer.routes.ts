import { Router } from 'express';
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from './customer.controller';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';
import { validate } from '../../core/middleware/validate.middleware';
import { createCustomerSchema, updateCustomerSchema } from '../../core/schemas/customer.schema';
import { recordCustomerPayment } from './customer.payment';

const router = Router();

router.use(tenantMiddleware);

router.get('/', listCustomers);
router.get('/:id', getCustomer);
router.post('/', validate(createCustomerSchema), createCustomer);
router.patch('/:id', validate(updateCustomerSchema), updateCustomer);
router.delete('/:id', requireRole(['admin', 'manager']), deleteCustomer);
router.post('/:id/payments', recordCustomerPayment);
router.post('/:id/payment', recordCustomerPayment);

export default router;
