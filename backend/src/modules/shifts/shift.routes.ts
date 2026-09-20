import { Router } from 'express';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';
import {
  getCurrentShift,
  openShift,
  closeShift,
  listShifts,
} from './shift.controller';

const router = Router();

router.use(tenantMiddleware);

router.get('/current', getCurrentShift);
router.post('/open', openShift);
router.post('/close', closeShift);
router.get('/', requireRole(['admin', 'manager']), listShifts);

export default router;
