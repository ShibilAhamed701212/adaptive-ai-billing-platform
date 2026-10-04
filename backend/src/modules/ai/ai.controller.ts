import { Request, Response, NextFunction } from 'express';
import { parseInvoicePromptWithTools } from '../../ai/invoice-agent/invoice-copilot';
import { processAskBusinessQuery } from '../../ai/finance-agent/ask-business';
import { BILLING_MODEL_PRESETS } from '../../billing-engine/billing-models/presets';
import { logAuditEvent } from '../../core/audit/audit.service';
import { callLLM, parseLlmJson, aiUnavailableError } from '../../ai/llm-provider';

/**
 * Validate a free-text input for an AI call. Oversized inputs are rejected rather than sent to the
 * provider: they cost real money and blow past model context limits.
 */
function aiText(value: unknown, field: string, max: number, required = true): string {
  const text = value === undefined || value === null ? '' : String(value);
  if (required && !text.trim()) {
    throw Object.assign(new Error(`${field} is required`), { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  if (text.length > max) {
    throw Object.assign(new Error(`${field} is too long (max ${max} characters)`), { statusCode: 400, code: 'INPUT_TOO_LONG' });
  }
  return text;
}

/** Call an AI-only feature (no deterministic fallback) and parse its JSON answer. */
async function callLLMJson(messages: Parameters<typeof callLLM>[0]): Promise<any> {
  const result = await callLLM(messages, { json: true });
  if (!result) throw aiUnavailableError();
  return parseLlmJson(result);
}

export async function draftInvoiceCopilot(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const prompt = aiText(req.body.prompt, 'Prompt', 2000);

    const draft = await parseInvoicePromptWithTools(orgId, prompt);

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'AI_COPILOT_DRAFT_INVOICE',
      entityType: 'AI_Copilot',
      details: { prompt, matchedCustomer: draft.customerName, itemCount: draft.items.length },
    });

    res.json({ success: true, data: draft });
  } catch (err) {
    next(err);
  }
}

export async function askBusiness(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const query = aiText(req.body.query, 'Question', 1000);

    const response = await processAskBusinessQuery(orgId, query);

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'AI_ASK_BUSINESS_QUERY',
      entityType: 'AI_Assistant',
      details: { query },
    });

    res.json({ success: true, data: response });
  } catch (err) {
    next(err);
  }
}

export async function suggestModelOnboarding(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessDescription = aiText(req.body.businessDescription, 'Business description', 2000);
    const industry = aiText(req.body.industry, 'Industry', 200, false);

    const systemPrompt = `You are an AI Billing Architect. Based on the business description and industry, suggest the best base billing model.
Valid models are: 'retail', 'subscription', 'rental', 'logistics', 'professional_services'.
Return ONLY valid JSON matching this structure:
{
  "suggestedModel": "string",
  "matchScore": number (80-99),
  "reason": "string"
}`;

    const parsed = await callLLMJson([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Description: ${businessDescription}\nIndustry: ${industry}` }
    ]);

    // Ensure we have a valid preset model
    const matchedModel = BILLING_MODEL_PRESETS[parsed.suggestedModel] ? parsed.suggestedModel : 'retail';
    const preset = BILLING_MODEL_PRESETS[matchedModel];

    res.json({
      success: true,
      data: {
        suggestedModel: matchedModel,
        matchScore: parsed.matchScore || 85,
        reason: parsed.reason || 'Standard product catalog and direct invoicing',
        preset,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function interactiveOnboardingInterview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { messages = [], answers = {}, forceFinalize = false } = req.body;
    const businessDescription = aiText(req.body.businessDescription, 'Business description', 2000, false);
    if (!Array.isArray(messages) || messages.length > 30 || typeof answers !== 'object' || answers === null || Object.keys(answers).length > 30) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid interview history' } });
      return;
    }

    // Compile entire conversation history context
    const conversationContext = messages
      .map((m: any) => `${String(m?.role || 'user').toUpperCase()}: ${aiText(m?.content, 'Message', 2000, false)}`)
      .join('\n');
    const answersContext = Object.entries(answers)
      .map(([q, a]) => `- ${aiText(q, 'Question', 500, false)}: ${aiText(a, 'Answer', 500, false)}`)
      .join('\n');

    const promptText = `
User Business Input:
"${businessDescription}"

${answersContext ? `User Answers to Previous Questions:\n${answersContext}\n` : ''}
${conversationContext ? `Conversation History:\n${conversationContext}\n` : ''}
Force Finalize Blueprint: ${forceFinalize ? 'YES' : 'NO'}

Evaluate if more clarifying questions are needed to configure custom fields and billing rules, OR if we have enough details to produce the final tailored architecture blueprint.
`;

    const systemPrompt = `You are the Lead AI Billing Architect for an enterprise multi-tenant billing platform.
Your job is to have a conversational discovery interview with the user about their business, ask 2 to 3 insightful clarifying questions when helpful, and formulate a tailored billing architecture blueprint with custom schema fields and business rules.

Supported base billing models:
- subscription: SaaS, tiered licensing, memberships, recurring cycles
- rental: Equipment leasing, vehicles, real estate, daily/monthly hire with deposits
- logistics: Freight transport, consignment per km/ton, fleet/driver metadata, toll/fuel surcharges
- professional_services: Agencies, legal/consulting, milestone billing, hourly rate cards, retainer POs
- retail: POS counter, ecommerce, inventory, barcode scanning, instant receipts

INSTRUCTIONS:
1. If the user input is brief, conversational, or has unanswered questions (and forceFinalize is false), set "status": "interviewing".
2. Provide a conversational, encouraging "aiMessage".
3. Provide 2-3 "clarifyingQuestions" with multiple-choice "options" to pin down their specific billing needs (e.g. billing cadence, custom invoice fields, deposit requirements).
4. Provide an interim "architecture" proposal tailored to what is known so far.
5. If the user has answered the clarifying questions OR forceFinalize is true, set "status": "ready" with a complete tailored architecture (customFields, businessRules, recommendedModules).

YOU MUST RESPOND ONLY WITH VALID JSON IN THIS FORMAT:
{
  "status": "interviewing" | "ready",
  "aiMessage": "string",
  "clarifyingQuestions": [
    {
      "id": "q1",
      "question": "string",
      "options": ["Option A", "Option B", "Option C", "Option D"]
    }
  ],
  "architecture": {
    "modelName": "string",
    "baseBillingModel": "subscription" | "rental" | "logistics" | "professional_services" | "retail",
    "matchScore": number (85-99),
    "summary": "string",
    "customFields": [
      {
        "targetEntity": "invoice" | "customer" | "product",
        "fieldName": "string (camelCase)",
        "label": "string",
        "fieldType": "text" | "number" | "select" | "date" | "boolean",
        "options": ["optional", "for", "select"],
        "required": boolean,
        "placeholder": "string"
      }
    ],
    "businessRules": [
      {
        "ruleName": "string",
        "description": "string",
        "event": "beforeInvoiceCalculate",
        "condition": { "field": "invoiceSubtotal", "operator": "greater_than", "value": 50000 },
        "action": { "type": "apply_discount", "value": 5, "message": "5% Volume Discount" }
      }
    ],
    "recommendedModules": ["invoices", "customers", "products", "payments", "subscriptions", "reports", "ai_copilot"],
    "suggestedTaxSystem": "GST"
  }
}`;

    const parsed = await callLLMJson([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: promptText },
    ]);
    if (!parsed || !parsed.architecture) {
      res.status(502).json({ success: false, error: { code: 'AI_BAD_RESPONSE', message: 'The AI returned an incomplete blueprint. Please try again.' } });
      return;
    }
    res.json({ success: true, data: parsed });
  } catch (err) {
    next(err);
  }
}

export async function parseOcrDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawText = aiText(req.body.rawText, 'Document text', 20000);
    const documentType = aiText(req.body.documentType || 'invoice', 'Document type', 50);

    const systemPrompt = `You are an OCR extraction AI. Extract the invoice details from the given text. 
Return ONLY valid JSON matching this structure:
{
  "extractedGstin": "string | null",
  "extractedInvoiceNumber": "string | null",
  "extractedTotal": number | null,
  "items": [
    { "description": "string", "quantity": number, "unitPrice": number, "taxRate": number, "lineTotal": number }
  ],
  "confidenceScore": number (0 to 1)
}`;

    const parsed = await callLLMJson([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Document Type: ${documentType}\n\nRaw Text:\n${rawText}` }
    ]);
    parsed.documentType = documentType;

    res.json({
      success: true,
      data: parsed,
    });
  } catch (err) {
    next(err);
  }
}

export async function parseOcrDocumentUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: { code: 'MISSING_FILE', message: 'An image or PDF file is required for OCR parsing' } });
      return;
    }

    const systemPrompt = `You are a highly accurate OCR extraction AI. Extract the invoice or receipt details from the provided image.
Return ONLY valid JSON matching this structure:
{
  "extractedGstin": "string | null",
  "extractedInvoiceNumber": "string | null",
  "extractedTotal": number | null,
  "items": [
    { "description": "string", "quantity": number, "unitPrice": number, "taxRate": number, "lineTotal": number }
  ],
  "confidenceScore": number (0 to 1)
}`;

    const base64Data = file.buffer.toString('base64');

    const parsed = await callLLMJson([
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Please extract the invoice details from this document.`,
        inlineData: { mimeType: file.mimetype, data: base64Data }
      }
    ]);
    parsed.documentType = 'invoice';

    res.json({
      success: true,
      data: parsed,
    });
  } catch (err) {
    next(err);
  }
}

export async function generateSmartReminder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const customerName = aiText(req.body.customerName, 'Customer name', 200);
    const invoiceNumber = aiText(req.body.invoiceNumber, 'Invoice number', 100);
    const amountDue = aiText(req.body.amountDue, 'Amount due', 50);
    const dueDate = aiText(req.body.dueDate, 'Due date', 50, false);
    const tone = aiText(req.body.tone || 'friendly', 'Tone', 50);

    const systemPrompt = `You are a Smart Reminder AI for a billing system. Generate an email reminder based on the details provided.
Return ONLY valid JSON matching this structure:
{
  "subject": "string",
  "message": "string",
  "recommendedSendTime": "string",
  "tone": "string"
}`;

    const parsed = await callLLMJson([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Customer: ${customerName}\nInvoice: ${invoiceNumber}\nAmount Due: ${amountDue}\nDue Date: ${dueDate || 'Not set'}\nRequested Tone: ${tone}` }
    ]);

    res.json({
      success: true,
      data: parsed,
    });
  } catch (err) {
    next(err);
  }
}

export async function generateAiInvoiceTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const prompt = aiText(req.body.prompt, 'Prompt', 2000);
    const industry = aiText(req.body.industry, 'Industry', 200, false);

    const systemPrompt = `You are an AI Invoice Template Designer. Based on the user prompt and industry, design a JSON specification for an invoice template.
Return ONLY valid JSON matching this structure:
{
  "templateName": "string",
  "description": "string",
  "layout": {
    "showLogo": boolean,
    "showGstin": boolean,
    "showHsnSac": boolean,
    "showCustomFields": boolean,
    "showPaymentTerms": boolean,
    "showNotes": boolean,
    "showTaxBreakdown": boolean,
    "showBankDetails": boolean,
    "columns": ["description", "quantity", "unitPrice", "taxRate", "lineTotal"],
    "sections": ["header", "customerInfo", "items", "taxBreakdown", "totals", "bankDetails", "notes", "footer"],
    "headerText": "string",
    "footerText": "string"
  },
  "brandColors": { "primary": "hex", "accent": "hex", "textColor": "hex", "bgColor": "hex" },
  "fontFamily": "string",
  "isDefault": false
}`;

    const parsed = await callLLMJson([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Prompt: ${prompt}\nIndustry: ${industry || 'General'}` }
    ]);

    res.json({
      success: true,
      data: parsed,
    });
  } catch (err) {
    next(err);
  }
}
