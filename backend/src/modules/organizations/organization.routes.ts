import { Router } from 'express';
import {
  getOrganizationProfile,
  updateOrganizationSettings,
  switchBillingModel,
} from './organization.controller';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';

const router = Router();

router.use(tenantMiddleware);

router.get('/profile', getOrganizationProfile);
router.patch('/settings', requireRole(['admin']), updateOrganizationSettings);
router.post('/switch-model', requireRole(['admin']), switchBillingModel);

export default router;
