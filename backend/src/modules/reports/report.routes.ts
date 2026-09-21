import { Router } from 'express';
import {
  getDashboardSummary,
  getRevenueReport,
  getARAgingReport,
  getCustomerStatement,
  getTopCustomersReport,
  getProfitReport,
  getBestSellersReport,
  getGSTSummaryReport,
  getSaasSummary,
  getAgencySummary
} from './report.controller';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';

const router = Router();

router.use(tenantMiddleware);

router.get('/dashboard-summary', getDashboardSummary);
router.get('/revenue', getRevenueReport);
router.get('/ar-aging', getARAgingReport);
router.get('/customer-statement/:customerId', getCustomerStatement);
router.get('/top-customers', getTopCustomersReport);
router.get('/profit', requireRole(['admin', 'manager', 'accountant']), getProfitReport);
router.get('/best-sellers', getBestSellersReport);
router.get('/gst-summary', requireRole(['admin', 'manager', 'accountant']), getGSTSummaryReport);
router.get('/saas', getSaasSummary);
router.get('/agency', getAgencySummary);

export default router;
