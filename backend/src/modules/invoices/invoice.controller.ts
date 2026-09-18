import { Request, Response, NextFunction } from 'express';
import { InvoiceModel } from '../../models/Invoice.model';
import { CustomerModel } from '../../models/Customer.model';
import { OrganizationModel } from '../../models/Organization.model';
import { CustomFieldModel } from '../../models/CustomField.model';
import { BusinessRuleModel } from '../../models/BusinessRule.model';
import { calculateInvoice } from '../../billing-engine/calculators/invoice-calculator';
import { validateCustomFields } from '../../dynamic-engine/custom-fields/field-validator';
import { evaluateBusinessRules } from '../../dynamic-engine/rules/rule-evaluator';
import { logAuditEvent } from '../../core/audit/audit.service';
import mongoose from 'mongoose';
import { generateInvoicePdf } from './invoice.pdf';
import { sendInvoiceEmail } from './invoice.email';

export async function listInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { status, customerId, search, page = 1, limit = 50 } = req.query;

    const query: any = { organizationId: new mongoose.Types.ObjectId(orgId) };
    if (status) {
      query.status = status;
    }
    if (customerId) {
      query.customerId = new mongoose.Types.ObjectId(String(customerId));
    }
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: String(search), $options: 'i' } },
        { 'customerSnapshot.name': { $regex: String(search), $options: 'i' } },
        { 'customerSnapshot.companyName': { $regex: String(search), $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [invoices, total] = await Promise.all([
      InvoiceModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      InvoiceModel.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: invoices,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
        hasMore: skip + invoices.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const invoice = await InvoiceModel.findOne({
      _id: req.params.id,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      return;
    }

    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
}

export async function calculatePreview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { items, customerId, invoiceDiscountAmount } = req.body;

    const org = await OrganizationModel.findById(orgId);
    if (!org) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Organization not found' } });
      return;
    }

    let customerState: string | undefined;
    if (customerId) {
      const customer = await CustomerModel.findById(customerId);
      customerState = customer?.billingAddress?.state;
    }

    // Evaluate dynamic rules
    const rules = await BusinessRuleModel.find({ organizationId: orgId, isActive: true }).lean();
    const rawSubtotalEstimate = (items || []).reduce(
      (acc: number, item: any) => acc + (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
      0
    );

    const ruleEffects = evaluateBusinessRules(rules, 'beforeInvoiceCalculate', {
      invoiceSubtotal: rawSubtotalEstimate,
      customerState,
      itemCount: items?.length || 0,
      customFields: req.body.customFields,
    });

    const calculation = calculateInvoice(items || [], {
      taxSystem: org.settings.taxSystem,
      originState: org.settings.address?.state,
      destinationState: customerState,
      invoiceDiscountAmount: Number(invoiceDiscountAmount) || 0,
    });

    res.json({
      success: true,
      data: {
        ...calculation,
        ruleEffects,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const userId = req.tenant!.userId;
    const {
      customerId,
      issueDate,
      dueDate,
      items,
      notes,
      terms,
      customFields,
      invoiceDiscountAmount,
      status = 'draft',
    } = req.body;

    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Customer ID and at least one item are required' },
      });
      return;
    }

    const org = await OrganizationModel.findById(orgId);
    const customer = await CustomerModel.findOne({
      _id: customerId,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!org || !customer) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Organization or Customer not found' },
      });
      return;
    }

    // Dynamic field validation
    const fieldDefs = await CustomFieldModel.find({ organizationId: orgId, targetEntity: 'invoice' }).lean();
    const validation = validateCustomFields(fieldDefs, customFields);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        error: { code: 'CUSTOM_FIELD_ERROR', message: 'Custom field validation failed', details: validation.errors },
      });
      return;
    }

    // Evaluate business rules
    const rules = await BusinessRuleModel.find({ organizationId: orgId, isActive: true }).lean();
    const ruleEffects = evaluateBusinessRules(rules, 'beforeInvoiceCalculate', {
      customerId: String(customer._id),
      customerState: customer.billingAddress?.state,
      itemCount: items.length,
      customFields,
    });

    // Run deterministic calculation engine
    const { items: processedItems, totals } = calculateInvoice(items, {
      taxSystem: org.settings.taxSystem,
      originState: org.settings.address?.state,
      destinationState: customer.billingAddress?.state,
      invoiceDiscountAmount: Number(invoiceDiscountAmount) || 0,
    });

    // Generate unique sequential invoice number
    const prefix = org.settings.invoicePrefix || 'INV';
    const nextSeq = org.settings.nextInvoiceNumber || 1001;
    const invoiceNumber = `${prefix}-${new Date().getFullYear()}-${nextSeq}`;

    // Increment counter atomically on org
    await OrganizationModel.findByIdAndUpdate(orgId, { $inc: { 'settings.nextInvoiceNumber': 1 } });

    // Determine initial status
    let initialStatus = status;
    if (ruleEffects.requireApproval) {
      initialStatus = 'pending_approval';
    }

    // AI Risk Scoring Heuristic
    let aiRiskScore: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let aiRiskExplanation = 'Standard billing schedule';
    if (customer.outstandingBalance > 50000 || (customer.creditLimit && customer.outstandingBalance > customer.creditLimit)) {
      aiRiskScore = 'HIGH';
      aiRiskExplanation = `Customer has elevated outstanding balance (₹${customer.outstandingBalance.toLocaleString()})`;
    } else if (totals.grandTotal > 100000) {
      aiRiskScore = 'MEDIUM';
      aiRiskExplanation = 'High-value transaction';
    }

    // Create Invoice with snapshots
    const invoice = await InvoiceModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      invoiceNumber,
      customerId: customer._id,
      customerSnapshot: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        companyName: customer.companyName,
        gstinOrTaxId: customer.gstinOrTaxId,
        billingAddress: customer.billingAddress,
      },
      issueDate: issueDate || new Date().toISOString().split('T')[0],
      dueDate: dueDate || new Date(Date.now() + (org.settings.paymentTermsDays || 30) * 86400000).toISOString().split('T')[0],
      currency: org.settings.currency || 'INR',
      currencySymbol: org.settings.currencySymbol || '₹',
      items: processedItems,
      subtotal: totals.rawSubtotal,
      discountTotal: totals.totalDiscount,
      taxTotal: totals.taxTotal,
      taxBreakdown: totals.taxBreakdown,
      grandTotal: totals.grandTotal,
      amountPaid: 0,
      amountDue: totals.grandTotal,
      status: initialStatus,
      notes,
      terms: terms || `Payment due within ${org.settings.paymentTermsDays || 30} days of invoice date.`,
      customFields: { ...(customFields || {}), ...(ruleEffects.injectedFields || {}) },
      aiRiskScore,
      aiRiskExplanation,
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    // Update customer outstanding balance if sent or approved
    if (initialStatus === 'sent' || initialStatus === 'approved') {
      await CustomerModel.findByIdAndUpdate(customer._id, {
        $inc: { outstandingBalance: totals.grandTotal },
      });
    }

    await logAuditEvent({
      organizationId: orgId,
      userId,
      userEmail: req.tenant!.email,
      action: 'CREATE_INVOICE',
      entityType: 'Invoice',
      entityId: String(invoice._id),
      details: { invoiceNumber, grandTotal: totals.grandTotal, customerName: customer.name },
    });

    res.status(201).json({
      success: true,
      data: invoice,
      ruleEffects: ruleEffects.appliedRules,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateInvoiceStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { status } = req.body;

    const invoice = await InvoiceModel.findOne({
      _id: req.params.id,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      return;
    }

    const previousStatus = invoice.status;
    invoice.status = status;
    await invoice.save();

    // Reconcile customer outstanding balance on state transition
    if (previousStatus === 'draft' && (status === 'sent' || status === 'approved')) {
      await CustomerModel.findByIdAndUpdate(invoice.customerId, {
        $inc: { outstandingBalance: invoice.amountDue },
      });
    } else if ((previousStatus === 'sent' || previousStatus === 'approved') && (status === 'void' || status === 'cancelled')) {
      await CustomerModel.findByIdAndUpdate(invoice.customerId, {
        $inc: { outstandingBalance: -invoice.amountDue },
      });
    }

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'UPDATE_INVOICE_STATUS',
      entityType: 'Invoice',
      entityId: String(invoice._id),
      details: { from: previousStatus, to: status, invoiceNumber: invoice.invoiceNumber },
    });

    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
}

export async function updateInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const invoiceId = req.params.id;
    const { issueDate, dueDate, items, notes, terms, customFields, invoiceDiscountAmount } = req.body;

    const invoice = await InvoiceModel.findOne({
      _id: invoiceId,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      return;
    }

    if (invoice.status !== 'draft') {
      res.status(400).json({
        success: false,
        error: { code: 'IMMUTABLE_INVOICE', message: `Cannot modify invoice with status '${invoice.status}'. Only draft invoices can be edited.` },
      });
      return;
    }

    const org = await OrganizationModel.findById(orgId);
    if (!org) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Organization not found' } });
      return;
    }

    // Recompute deterministic totals if items or discounts changed
    const itemsToProcess = items || invoice.items;
    const { items: processedItems, totals } = calculateInvoice(itemsToProcess, {
      taxSystem: org.settings.taxSystem,
      originState: org.settings.address?.state,
      destinationState: invoice.customerSnapshot?.billingAddress?.state,
      invoiceDiscountAmount: invoiceDiscountAmount !== undefined ? Number(invoiceDiscountAmount) : invoice.discountTotal,
    });

    invoice.items = processedItems;
    invoice.subtotal = totals.rawSubtotal;
    invoice.discountTotal = totals.totalDiscount;
    invoice.taxTotal = totals.taxTotal;
    invoice.taxBreakdown = totals.taxBreakdown;
    invoice.grandTotal = totals.grandTotal;
    invoice.amountDue = totals.grandTotal;

    if (issueDate) invoice.issueDate = issueDate;
    if (dueDate) invoice.dueDate = dueDate;
    if (notes !== undefined) invoice.notes = notes;
    if (terms !== undefined) invoice.terms = terms;
    if (customFields) invoice.customFields = { ...(invoice.customFields || {}), ...customFields };

    await invoice.save();

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'UPDATE_INVOICE_DRAFT',
      entityType: 'Invoice',
      entityId: String(invoice._id),
      details: { invoiceNumber: invoice.invoiceNumber, grandTotal: invoice.grandTotal },
    });

    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
}

export async function deleteInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const invoiceId = req.params.id;

    const invoice = await InvoiceModel.findOne({
      _id: invoiceId,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      return;
    }

    if (invoice.status === 'paid' || invoice.amountPaid > 0) {
      res.status(400).json({
        success: false,
        error: { code: 'CANNOT_DELETE_PAID', message: 'Invoices with recorded payments cannot be cancelled. Issue a credit note or refund first.' },
      });
      return;
    }

    const previousStatus = invoice.status;
    invoice.status = 'cancelled';
    await invoice.save();

    // Deduct balance from customer if was previously counted in receivables
    if (previousStatus === 'sent' || previousStatus === 'approved') {
      await CustomerModel.findByIdAndUpdate(invoice.customerId, {
        $inc: { outstandingBalance: -invoice.amountDue },
      });
    }

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'CANCEL_INVOICE',
      entityType: 'Invoice',
      entityId: String(invoice._id),
      details: { invoiceNumber: invoice.invoiceNumber, fromStatus: previousStatus },
    });

    res.json({ success: true, message: `Invoice ${invoice.invoiceNumber} has been cancelled successfully.` });
  } catch (err) {
    next(err);
  }
}



export async function downloadPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const invoice = await InvoiceModel.findOne({ _id: req.params.id, organizationId: new mongoose.Types.ObjectId(orgId) }).lean();
    if (!invoice) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      return;
    }
    const org = await OrganizationModel.findById(orgId).lean();
    await generateInvoicePdf(invoice, org, res);
  } catch (err) {
    next(err);
  }
}

export async function sendEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const invoice = await InvoiceModel.findOne({ _id: req.params.id, organizationId: new mongoose.Types.ObjectId(orgId) }).lean();
    if (!invoice) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      return;
    }
    const org = await OrganizationModel.findById(orgId).lean();
    
    // In a real app you might accept a recipient email in the request body, 
    // but here we just use the customer's email from the snapshot.
    const toEmail = req.body.email || invoice.customerSnapshot.email;
    if (!toEmail) {
      res.status(400).json({ success: false, error: { code: 'MISSING_EMAIL', message: 'No email address available for customer.' } });
      return;
    }

    await sendInvoiceEmail(invoice, org, toEmail);
    
    // Update status to sent if it was just approved (or draft)
    if (invoice.status === 'draft' || invoice.status === 'approved') {
      await InvoiceModel.updateOne({ _id: invoice._id }, { status: 'sent' });
    }

    res.json({ success: true, message: `Email sent to ${toEmail}` });
  } catch (err) {
    next(err);
  }
}
