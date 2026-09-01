import { Router } from 'express';
import { listAuditLogs } from './audit.controller';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';

const router = Router();

router.use(tenantMiddleware);
router.get('/', requireRole(['admin', 'manager']), listAuditLogs);

export default router;
