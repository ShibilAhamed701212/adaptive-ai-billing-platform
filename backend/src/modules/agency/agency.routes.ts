import { Router } from 'express';
import { 
  listProjects, createProject, updateProject, deleteProject,
  listTimesheets, createTimesheet, updateTimesheet, deleteTimesheet,
  listRetainers, createRetainer, updateRetainer, deleteRetainer
} from './agency.controller';
import { tenantMiddleware, requireModule, requireRole } from '../../core/tenancy/tenant.middleware';

const router = Router();

router.use(tenantMiddleware);
router.use(requireModule('projects')); // Main module for agency

router.get('/projects', listProjects);
router.post('/projects', requireRole(['admin', 'manager']), createProject);
router.put('/projects/:id', requireRole(['admin', 'manager']), updateProject);
router.delete('/projects/:id', requireRole(['admin']), deleteProject);

router.get('/timesheets', listTimesheets);
router.post('/timesheets', createTimesheet);
router.put('/timesheets/:id', updateTimesheet);
router.delete('/timesheets/:id', requireRole(['admin', 'manager']), deleteTimesheet);

router.get('/retainers', listRetainers);
router.post('/retainers', requireRole(['admin', 'manager']), createRetainer);
router.put('/retainers/:id', requireRole(['admin', 'manager']), updateRetainer);
router.delete('/retainers/:id', requireRole(['admin']), deleteRetainer);

export default router;
