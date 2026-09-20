import { Router } from 'express';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';
import {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from './supplier.controller';

const router = Router();

router.use(tenantMiddleware);

router.get('/', listSuppliers);
router.post('/', requireRole(['admin', 'manager', 'accountant']), createSupplier);
router.patch('/:id', requireRole(['admin', 'manager']), updateSupplier);
router.delete('/:id', requireRole(['admin', 'manager']), deleteSupplier);

export default router;
