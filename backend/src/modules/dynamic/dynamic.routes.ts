import { Router } from 'express';
import {
  listCustomFields,
  createCustomField,
  deleteCustomField,
  listBusinessRules,
  createBusinessRule,
  deleteBusinessRule,
  getBillingPresets,
} from './dynamic.controller';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';

const router = Router();

// Public preset listing
router.get('/presets', getBillingPresets);

// Tenant-scoped routes
router.use(tenantMiddleware);

router.get('/fields', listCustomFields);
router.post('/fields', requireRole(['admin']), createCustomField);
router.delete('/fields/:id', requireRole(['admin']), deleteCustomField);

router.get('/rules', listBusinessRules);
router.post('/rules', requireRole(['admin']), createBusinessRule);
router.delete('/rules/:id', requireRole(['admin']), deleteBusinessRule);

export default router;
