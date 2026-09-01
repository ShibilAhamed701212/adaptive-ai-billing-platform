import { Router } from 'express';
import {
  draftInvoiceCopilot,
  askBusiness,
  suggestModelOnboarding,
  parseOcrDocument,
  generateSmartReminder,
  generateAiInvoiceTemplate,
} from './ai.controller';
import { tenantMiddleware } from '../../core/tenancy/tenant.middleware';

const router = Router();

// Onboarding model suggestion
router.post('/onboarding/suggest-model', suggestModelOnboarding);

// Authenticated AI operations
router.use(tenantMiddleware);
router.post('/copilot/draft-invoice', draftInvoiceCopilot);
router.post('/ask-business', askBusiness);
router.post('/ocr/parse-document', parseOcrDocument);
router.post('/reminders/generate', generateSmartReminder);
router.post('/templates/generate', generateAiInvoiceTemplate);

export default router;
