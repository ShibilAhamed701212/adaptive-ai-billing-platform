import { Router } from 'express';
import { listPendingApprovals, approveItem, rejectItem } from './approval.controller';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';

const router = Router();

router.use(tenantMiddleware);
router.get('/', listPendingApprovals);
router.post('/:id/approve', requireRole(['admin', 'manager']), approveItem);
router.post('/:id/reject', requireRole(['admin', 'manager']), rejectItem);

export default router;
