import { Router } from 'express';
import multer from 'multer';
import { createRateLimiter } from '../../core/middleware/rate-limiter.middleware';
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
const OCR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (OCR_TYPES.has(file.mimetype)) return cb(null, true);
    cb(Object.assign(new Error('Upload a PNG, JPEG, WebP image or a PDF'), { statusCode: 415, code: 'UNSUPPORTED_FILE_TYPE' }));
  },
});

// AI calls cost money per request: cap each user's usage.
const aiRateLimiter = createRateLimiter({
  max: 30,
  windowMs: 10 * 60_000,
  key: (req) => `ai:${req.tenant?.userId || req.ip}`,
  message: 'AI request limit reached. Please wait a few minutes.',
});

// All AI operations (including onboarding assistance) require an authenticated tenant session.
router.use(tenantMiddleware);
router.use(aiRateLimiter);

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
