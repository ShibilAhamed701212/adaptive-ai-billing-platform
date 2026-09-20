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

// All AI operations (including onboarding assistance) require an authenticated tenant session.
router.use(tenantMiddleware);

// Onboarding model suggestions & conversational interview
router.post('/onboarding/suggest-model', suggestModelOnboarding);
router.post('/onboarding/interview', interactiveOnboardingInterview);
router.post('/copilot/draft-invoice', draftInvoiceCopilot);
router.post('/copilot/draft', draftInvoiceCopilot);
router.post('/ask-business', askBusiness);
router.post('/ocr/parse-document', parseOcrDocument);
router.post('/ocr/upload', upload.single('file'), parseOcrDocumentUpload);
router.post('/reminders/generate', generateSmartReminder);
router.post('/templates/generate', generateAiInvoiceTemplate);

export default router;
