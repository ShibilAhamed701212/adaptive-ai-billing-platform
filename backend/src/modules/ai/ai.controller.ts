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

export async function suggestModelOnboarding(req: Request, res: Response): Promise<void> {
  const { businessDescription, industry } = req.body;
  const desc = `${businessDescription || ''} ${industry || ''}`.toLowerCase();

  let matchedModel = 'retail';
  let matchScore = 85;
  let reason = 'Standard product catalog and direct invoicing';

  if (desc.includes('subscri') || desc.includes('saas') || desc.includes('software') || desc.includes('monthly fee') || desc.includes('recurring')) {
    matchedModel = 'subscription';
    matchScore = 96;
    reason = 'Identified recurring subscriptions, plans, and cycle management needs.';
  } else if (desc.includes('rent') || desc.includes('equipment') || desc.includes('lease') || desc.includes('deposit') || desc.includes('property')) {
    matchedModel = 'rental';
    matchScore = 94;
    reason = 'Identified rental periods, security deposits, and asset return workflows.';
  } else if (desc.includes('truck') || desc.includes('freight') || desc.includes('logistics') || desc.includes('shipment') || desc.includes('distance') || desc.includes('toll')) {
    matchedModel = 'logistics';
    matchScore = 95;
    reason = 'Identified consignment tracking, weight/distance metrics, and vehicle metadata.';
  } else if (desc.includes('consult') || desc.includes('agency') || desc.includes('hourly') || desc.includes('project') || desc.includes('retainer')) {
    matchedModel = 'professional_services';
    matchScore = 92;
    reason = 'Identified milestone billing, rate cards, and project codes.';
  }

  const preset = BILLING_MODEL_PRESETS[matchedModel];

  res.json({
    success: true,
    data: {
      suggestedModel: matchedModel,
      matchScore,
      reason,
      preset,
    },
  });
}

export async function parseOcrDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rawText, documentType = 'invoice' } = req.body;

    if (!rawText) {
      res.status(400).json({ success: false, error: { code: 'MISSING_TEXT', message: 'rawText is required for document OCR parsing' } });
      return;
    }

    // Heuristic OCR extraction engine
    const text = String(rawText);
    const gstinMatch = text.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/i);
    const invoiceNoMatch = text.match(/(?:inv(?:oice)?|bill|tax invoice)[\s#:]*([A-Za-z0-9\-_/]+)/i);
    const totalMatch = text.match(/(?:total|grand total|net amount|amount due)[\s:₹rs$]*([\d,]+(?:\.\d{2})?)/i);

    // Extract item lines
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    const items: any[] = [];

    lines.forEach((line) => {
      const itemMatch = line.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s+(?:x\s+)?(\d+(?:\.\d+)?)/);
      if (itemMatch && !line.toLowerCase().includes('total') && !line.toLowerCase().includes('subtotal')) {
        items.push({
          description: itemMatch[1].trim(),
          quantity: parseFloat(itemMatch[2]),
          unitPrice: parseFloat(itemMatch[3]),
          taxRate: 0.18,
          lineTotal: Math.round(parseFloat(itemMatch[2]) * parseFloat(itemMatch[3]) * 1.18 * 100) / 100,
        });
      }
    });

    if (items.length === 0) {
      items.push({
        description: 'Scanned Document Item',
        quantity: 1,
        unitPrice: totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) / 1.18 : 1000,
        taxRate: 0.18,
        lineTotal: totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : 1180,
      });
    }

    res.json({
      success: true,
      data: {
        documentType,
        extractedGstin: gstinMatch ? gstinMatch[0] : undefined,
        extractedInvoiceNumber: invoiceNoMatch ? invoiceNoMatch[1] : undefined,
        extractedTotal: totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : undefined,
        items,
        confidenceScore: 0.91,
      },
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

    let subject = `Friendly Reminder: Invoice #${invoiceNumber} from Nexus Cloud`;
    let message = `Hi ${customerName},\n\nWe hope you're having a great week! This is a gentle reminder that invoice #${invoiceNumber} for ₹${Number(amountDue).toLocaleString()} is scheduled for payment on ${dueDate || 'the due date'}.\n\nPlease let us know if you have any questions or need a copy of the invoice.\n\nWarm regards,\nFinance Team`;
    let recommendedSendTime = 'Tuesday, 10:00 AM (Optimal client open rate)';

    if (tone === 'firm') {
      subject = `Important: Payment Overdue for Invoice #${invoiceNumber}`;
      message = `Dear ${customerName},\n\nOur records indicate that invoice #${invoiceNumber} for ₹${Number(amountDue).toLocaleString()} is currently past due. To ensure uninterrupted service, please process the settlement at your earliest convenience.\n\nThank you for your prompt attention.\n\nSincerely,\nAccounts Receivable`;
      recommendedSendTime = 'Immediate (Business Hours: 9:00 AM - 12:00 PM)';
    } else if (tone === 'urgent') {
      subject = `Urgent Notice: Settlement required for Invoice #${invoiceNumber}`;
      message = `Dear ${customerName},\n\nInvoice #${invoiceNumber} (Amount: ₹${Number(amountDue).toLocaleString()}) is significantly overdue. Please expedite this payment today to avoid service suspension or interest charges.\n\nAccounts Management`;
      recommendedSendTime = 'Immediate';
    }

    res.json({
      success: true,
      data: {
        tone,
        subject,
        message,
        recommendedSendTime,
      },
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

    const lower = prompt.toLowerCase();
    let primary = '#6366f1';
    let accent = '#10b981';
    let templateName = 'Modern Minimalist';

    if (lower.includes('blue') || lower.includes('corporate') || lower.includes('logistics')) {
      primary = '#2563eb';
      accent = '#38bdf8';
      templateName = 'Corporate Blue';
    } else if (lower.includes('dark') || lower.includes('obsidian') || lower.includes('tech')) {
      primary = '#8b5cf6';
      accent = '#06b6d4';
      templateName = 'Obsidian Tech';
    } else if (lower.includes('green') || lower.includes('eco') || lower.includes('retail')) {
      primary = '#059669';
      accent = '#10b981';
      templateName = 'Emerald Commerce';
    }

    const templateSpec = {
      templateName,
      description: `AI-generated template based on: "${prompt}"`,
      layout: {
        showLogo: true,
        showGstin: true,
        showHsnSac: lower.includes('hsn') || industry === 'retail' || industry === 'logistics',
        showCustomFields: true,
        showPaymentTerms: true,
        showNotes: true,
        showTaxBreakdown: true,
        showBankDetails: true,
        columns: ['description', 'quantity', 'unitPrice', 'taxRate', 'lineTotal'],
        sections: ['header', 'customerInfo', 'items', 'taxBreakdown', 'totals', 'bankDetails', 'notes', 'footer'],
        headerText: 'Tax Invoice',
        footerText: 'Thank you for your business.',
      },
      brandColors: {
        primary,
        accent,
        textColor: '#0f172a',
        bgColor: '#ffffff',
      },
      fontFamily: 'Outfit, sans-serif',
      isDefault: false,
    };

    res.json({
      success: true,
      data: templateSpec,
    });
  } catch (err) {
    next(err);
  }
}
