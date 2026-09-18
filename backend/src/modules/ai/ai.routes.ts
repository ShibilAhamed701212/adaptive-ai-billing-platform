import { Router } from 'express';
import multer from 'multer';
import { tenantMiddleware } from '../../core/tenancy/tenant.middleware';
import {
  draftInvoiceCopilot,
  askBusiness,
  suggestModelOnboarding,
  interactiveOnboardingInterview,
  parseOcrDocument,
  parseOcrDocumentUpload,
  generateSmartReminder,
  generateAiInvoiceTemplate,
} from './ai.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// Onboarding model suggestions & conversational interview
router.post('/onboarding/suggest-model', suggestModelOnboarding);
router.post('/onboarding/interview', interactiveOnboardingInterview);

// Authenticated AI operations
router.use(tenantMiddleware);
router.post('/copilot/draft-invoice', draftInvoiceCopilot);
router.post('/copilot/draft', draftInvoiceCopilot);
router.post('/ask-business', askBusiness);
router.post('/ocr/parse-document', parseOcrDocument);
router.post('/ocr/upload', upload.single('file'), parseOcrDocumentUpload);
router.post('/reminders/generate', generateSmartReminder);
router.post('/templates/generate', generateAiInvoiceTemplate);

export default router;
