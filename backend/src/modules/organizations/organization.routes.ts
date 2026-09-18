import { Router } from 'express';
import {
  getOrganizationProfile,
  updateOrganizationSettings,
  switchBillingModel,
  applyCustomArchitecture,
} from './organization.controller';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';

const router = Router();

router.use(tenantMiddleware);

router.get('/profile', getOrganizationProfile);
router.patch('/settings', requireRole(['admin']), updateOrganizationSettings);
router.post('/switch-model', requireRole(['admin']), switchBillingModel);
router.post('/apply-architecture', requireRole(['admin']), applyCustomArchitecture);

export default router;
