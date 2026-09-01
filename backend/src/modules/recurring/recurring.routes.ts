import { Router } from 'express';
import {
  listRecurringProfiles,
  createRecurringProfile,
  updateRecurringProfile,
  triggerManualRun,
} from './recurring.controller';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';

const router = Router();

router.use(tenantMiddleware);
router.get('/', listRecurringProfiles);
router.post('/', requireRole(['admin', 'manager', 'accountant']), createRecurringProfile);
router.patch('/:id', requireRole(['admin', 'manager']), updateRecurringProfile);
router.post('/:id/run', requireRole(['admin', 'manager']), triggerManualRun);

export default router;
