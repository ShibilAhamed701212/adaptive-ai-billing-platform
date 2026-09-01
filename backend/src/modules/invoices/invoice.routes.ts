import { Router } from 'express';
import {
  listInvoices,
  getInvoice,
  createInvoice,
  calculatePreview,
  updateInvoiceStatus,
  updateInvoice,
  deleteInvoice,
} from './invoice.controller';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';
import { validate } from '../../core/middleware/validate.middleware';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  previewInvoiceSchema,
  updateInvoiceStatusSchema,
} from '../../core/schemas/invoice.schema';

const router = Router();

router.use(tenantMiddleware);

router.get('/', listInvoices);
router.post('/preview', validate(previewInvoiceSchema), calculatePreview);
router.get('/:id', getInvoice);
router.post('/', validate(createInvoiceSchema), createInvoice);
router.patch('/:id', validate(updateInvoiceSchema), updateInvoice);
router.patch('/:id/status', requireRole(['admin', 'manager', 'accountant']), validate(updateInvoiceStatusSchema), updateInvoiceStatus);
router.delete('/:id', requireRole(['admin', 'manager']), deleteInvoice);

export default router;
