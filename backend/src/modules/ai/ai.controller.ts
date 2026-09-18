import { Request, Response, NextFunction } from 'express';
import { parseInvoicePromptWithTools } from '../../ai/invoice-agent/invoice-copilot';
import { processAskBusinessQuery } from '../../ai/finance-agent/ask-business';
import { BILLING_MODEL_PRESETS } from '../../billing-engine/billing-models/presets';
import { logAuditEvent } from '../../core/audit/audit.service';

export async function draftInvoiceCopilot(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { prompt } = req.body;

    if (!prompt) {
      res.status(400).json({ success: false, error: { code: 'MISSING_PROMPT', message: 'Prompt text is required' } });
      return;
    }

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
    const { query } = req.body;

    if (!query) {
      res.status(400).json({ success: false, error: { code: 'MISSING_QUERY', message: 'Query string is required' } });
      return;
    }

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
    const { businessDescription, industry } = req.body;
    
    const { callLLM } = await import('../../ai/llm-provider');
    const systemPrompt = `You are an AI Billing Architect. Based on the business description and industry, suggest the best base billing model.
Valid models are: 'retail', 'subscription', 'rental', 'logistics', 'professional_services'.
Return ONLY valid JSON matching this structure:
{
  "suggestedModel": "string",
  "matchScore": number (80-99),
  "reason": "string"
}`;

    const llmResult = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Description: ${businessDescription}\nIndustry: ${industry}` }
    ], { json: true });

    if (!llmResult) throw new Error('LLM failed to return a response.');
    const parsed = JSON.parse(llmResult);
    
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
    const { messages = [], businessDescription = '', answers = {}, forceFinalize = false } = req.body;

    // Compile entire conversation history context
    const conversationContext = messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const answersContext = Object.entries(answers).map(([q, a]) => `- ${q}: ${a}`).join('\n');

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

    const { callLLM } = await import('../../ai/llm-provider');
    const llmResult = await callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptText },
      ],
      { json: true }
    );

    if (!llmResult) {
      throw new Error('LLM failed to return a response.');
    }

    try {
      const parsed = JSON.parse(llmResult);
      if (parsed && parsed.architecture) {
        res.json({ success: true, data: parsed });
        return;
      }
      throw new Error('Invalid JSON structure returned by LLM');
    } catch (e: any) {
      console.error('Failed to parse LLM onboarding JSON response:', e);
      res.status(500).json({ success: false, error: { message: 'AI failed to generate a valid response', details: e.message } });
    }
  } catch (err) {
    next(err);
  }
}

export async function parseOcrDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rawText, documentType = 'invoice' } = req.body;

    if (!rawText) {
      res.status(400).json({ success: false, error: { code: 'MISSING_TEXT', message: 'rawText is required for document OCR parsing' } });
      return;
    }

    const { callLLM } = await import('../../ai/llm-provider');
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

    const llmResult = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Document Type: ${documentType}\n\nRaw Text:\n${rawText}` }
    ], { json: true });

    if (!llmResult) throw new Error('LLM failed to return a response.');

    const parsed = JSON.parse(llmResult);
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

    const { callLLM } = await import('../../ai/llm-provider');
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

    const llmResult = await callLLM([
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Please extract the invoice details from this document.`,
        inlineData: { mimeType: file.mimetype, data: base64Data }
      }
    ], { json: true });

    if (!llmResult) throw new Error('LLM failed to return a response.');

    const parsed = JSON.parse(llmResult);
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
    const { customerName, invoiceNumber, amountDue, dueDate, tone = 'friendly' } = req.body;

    if (!customerName || !invoiceNumber || !amountDue) {
      res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'customerName, invoiceNumber, and amountDue are required' } });
      return;
    }

    const { callLLM } = await import('../../ai/llm-provider');
    const systemPrompt = `You are a Smart Reminder AI for a billing system. Generate an email reminder based on the details provided.
Return ONLY valid JSON matching this structure:
{
  "subject": "string",
  "message": "string",
  "recommendedSendTime": "string",
  "tone": "string"
}`;

    const llmResult = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Customer: ${customerName}\nInvoice: ${invoiceNumber}\nAmount Due: ${amountDue}\nDue Date: ${dueDate || 'Not set'}\nRequested Tone: ${tone}` }
    ], { json: true });

    if (!llmResult) throw new Error('LLM failed to return a response.');
    const parsed = JSON.parse(llmResult);

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
    const { prompt, industry } = req.body;

    if (!prompt) {
      res.status(400).json({ success: false, error: { code: 'MISSING_PROMPT', message: 'Prompt is required for template generation' } });
      return;
    }

    const { callLLM } = await import('../../ai/llm-provider');
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

    const llmResult = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Prompt: ${prompt}\nIndustry: ${industry || 'General'}` }
    ], { json: true });

    if (!llmResult) throw new Error('LLM failed to return a response.');
    const parsed = JSON.parse(llmResult);

    res.json({
      success: true,
      data: parsed,
    });
  } catch (err) {
    next(err);
  }
}
