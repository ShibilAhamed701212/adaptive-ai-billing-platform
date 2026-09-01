import { Router } from 'express';
import {
  getDashboardSummary,
  getRevenueReport,
  getARAgingReport,
  getCustomerStatement,
  getTopCustomersReport,
} from './report.controller';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';

const router = Router();

router.use(tenantMiddleware);

router.get('/dashboard-summary', getDashboardSummary);
router.get('/revenue', getRevenueReport);
router.get('/ar-aging', getARAgingReport);
router.get('/customer-statement/:customerId', getCustomerStatement);
router.get('/top-customers', getTopCustomersReport);

export default router;
