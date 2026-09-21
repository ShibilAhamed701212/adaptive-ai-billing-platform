import { Router } from 'express';
import { 
  listPlans, createPlan, updatePlan, deletePlan, 
  listSubscriptions, createSubscription, updateSubscription, deleteSubscription 
} from './saas.controller';
import { tenantMiddleware, requireModule, requireRole } from '../../core/tenancy/tenant.middleware';

const router = Router();

router.use(tenantMiddleware);
router.use(requireModule('subscriptions'));

router.get('/plans', listPlans);
router.post('/plans', requireRole(['admin', 'manager']), createPlan);
router.put('/plans/:id', requireRole(['admin', 'manager']), updatePlan);
router.delete('/plans/:id', requireRole(['admin', 'manager']), deletePlan);

router.get('/subscriptions', listSubscriptions);
router.post('/subscriptions', requireRole(['admin', 'manager']), createSubscription);
router.put('/subscriptions/:id', requireRole(['admin', 'manager']), updateSubscription);
router.delete('/subscriptions/:id', requireRole(['admin', 'manager']), deleteSubscription);

export default router;
