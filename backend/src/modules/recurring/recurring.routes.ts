import { Router } from 'express';
import {
  listRecurringProfiles,
  createRecurringProfile,
  updateRecurringProfile,
  triggerManualRun,
} from './recurring.controller';
import { tenantMiddleware, requireRole, requireModule } from '../../core/tenancy/tenant.middleware';

const router = Router();

router.use(tenantMiddleware);
router.use(requireModule('subscriptions'));
router.get('/', listRecurringProfiles);
router.post('/', requireRole(['admin', 'manager', 'accountant']), createRecurringProfile);
router.patch('/:id', requireRole(['admin', 'manager', 'accountant']), updateRecurringProfile);
router.put('/:id', requireRole(['admin', 'manager', 'accountant']), updateRecurringProfile);
router.post('/:id/run', requireRole(['admin', 'manager']), triggerManualRun);

export default router;
