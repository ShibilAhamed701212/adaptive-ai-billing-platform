import { Router } from 'express';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';
import { exportTenantBackup, restoreTenantBackup, reseedAnalyticsData } from './system.controller';

const router = Router();

router.post('/reseed-analytics', reseedAnalyticsData);

router.use(tenantMiddleware);

router.get('/backup', requireRole(['admin']), exportTenantBackup);
router.post('/backup', requireRole(['admin']), exportTenantBackup);
router.post('/restore', requireRole(['admin']), restoreTenantBackup);

export default router;
