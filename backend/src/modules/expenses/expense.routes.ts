import { Router } from 'express';
import { tenantMiddleware, requireRole, requireModule } from '../../core/tenancy/tenant.middleware';
import { listExpenses, createExpense, deleteExpense } from './expense.controller';

const router = Router();

router.use(tenantMiddleware);
router.use(requireModule('expenses'));

router.get('/', listExpenses);
router.post('/', requireRole(['admin', 'manager', 'cashier']), createExpense);
router.delete('/:id', requireRole(['admin', 'manager']), deleteExpense);

export default router;
