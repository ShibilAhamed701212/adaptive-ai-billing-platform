import { Router } from 'express';
import { listCreditNotes, getCreditNote, createCreditNote } from './credit-note.controller';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';

const router = Router();

router.use(tenantMiddleware);
router.get('/', listCreditNotes);
router.get('/:id', getCreditNote);
router.post('/', requireRole(['admin', 'manager', 'accountant']), createCreditNote);

export default router;
