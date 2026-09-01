import { Router } from 'express';
import { listTemplates, createTemplate, updateTemplate, deleteTemplate } from './template.controller';
import { tenantMiddleware, requireRole } from '../../core/tenancy/tenant.middleware';

const router = Router();

router.use(tenantMiddleware);
router.get('/', listTemplates);
router.post('/', requireRole(['admin']), createTemplate);
router.patch('/:id', requireRole(['admin']), updateTemplate);
router.delete('/:id', requireRole(['admin']), deleteTemplate);

export default router;
