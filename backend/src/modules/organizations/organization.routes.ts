import { Router } from 'express';
import {
  getOrganizationProfile,
  listMyOrganizations,
  createOrganization,
  switchOrganization,
  acceptInvitation,
  declineInvitation,
  updateOrganizationSettings,
  switchBillingModel,
  applyCustomArchitecture,
} from './organization.controller';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';

const router = Router();

router.use(tenantMiddleware);

// Membership-aware organization management
router.get('/mine', listMyOrganizations);
router.post('/', createOrganization);
router.post('/switch', switchOrganization);
router.post('/invitations/:membershipId/accept', acceptInvitation);
router.post('/invitations/:membershipId/decline', declineInvitation);

router.get('/profile', getOrganizationProfile);
router.patch('/settings', requireRole(['admin', 'manager']), updateOrganizationSettings);
router.post('/switch-model', requireRole(['admin']), switchBillingModel);
router.post('/apply-architecture', requireRole(['admin']), applyCustomArchitecture);

export default router;
