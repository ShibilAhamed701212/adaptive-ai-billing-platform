import { Router } from 'express';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';
import { exportTenantBackup, restoreTenantBackup, reseedAnalyticsData } from './system.controller';

const router = Router();

router.use(tenantMiddleware);

router.post('/reseed-analytics', requireRole(['admin']), reseedAnalyticsData);

router.get('/backup', requireRole(['admin']), exportTenantBackup);
router.post('/backup', requireRole(['admin']), exportTenantBackup);
router.post('/restore', requireRole(['admin']), restoreTenantBackup);

export default router;
