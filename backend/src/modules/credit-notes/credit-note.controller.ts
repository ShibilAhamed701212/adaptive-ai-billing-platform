import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { CreditNoteModel } from '../../models/CreditNote.model';
import { InvoiceModel } from '../../models/Invoice.model';
import { CustomerModel } from '../../models/Customer.model';
import { OrganizationModel } from '../../models/Organization.model';
import { logAuditEvent } from '../../core/audit/audit.service';

export async function listCreditNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { originalInvoiceId, customerId, status } = req.query;

    const query: any = { organizationId: new mongoose.Types.ObjectId(orgId) };
    if (originalInvoiceId) query.originalInvoiceId = new mongoose.Types.ObjectId(String(originalInvoiceId));
    if (customerId) query.customerId = new mongoose.Types.ObjectId(String(customerId));
    if (status) query.status = status;

    const notes = await CreditNoteModel.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: notes });
  } catch (err) {
    next(err);
  }
}

export async function getCreditNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const note = await CreditNoteModel.findOne({
      _id: req.params.id,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!note) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Credit note not found' } });
      return;
    }

    res.json({ success: true, data: note });
  } catch (err) {
    next(err);
  }
}

export async function createCreditNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const userId = req.tenant!.userId;
    const { originalInvoiceId, reason, items, notes, customFields, autoApply } = req.body;

    if (!originalInvoiceId || !reason || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Original invoice ID, reason, and at least one item are required' },
      });
      return;
    }

    const invoice = await InvoiceModel.findOne({
      _id: originalInvoiceId,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Original invoice not found' } });
      return;
    }

    const org = await OrganizationModel.findById(orgId);

    // Calculate credit note totals
    let subtotal = 0;
    let taxTotal = 0;

    const processedItems = items.map((item: any) => {
      const qty = Number(item.quantity) || 1;
      const rate = Number(item.unitPrice) || 0;
      const taxRate = Number(item.taxRate) || 0;
      const lineTaxable = Math.round(qty * rate * 100) / 100;
      const lineTax = Math.round(lineTaxable * taxRate * 100) / 100;
      const lineTotal = lineTaxable + lineTax;

      subtotal += lineTaxable;
      taxTotal += lineTax;

      return {
        description: item.description,
        quantity: qty,
        unitPrice: rate,
        taxRate,
        taxAmount: lineTax,
        lineTotal,
      };
    });

    const totalAmount = Math.round((subtotal + taxTotal) * 100) / 100;

    // Generate credit note number
    const count = await CreditNoteModel.countDocuments({ organizationId: new mongoose.Types.ObjectId(orgId) });
    const creditNoteNumber = `CN-${new Date().getFullYear()}-${1001 + count}`;

    const creditNote = await CreditNoteModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      creditNoteNumber,
      originalInvoiceId: invoice._id,
      customerId: invoice.customerId,
      reason,
      items: processedItems,
      subtotal,
      taxTotal,
      totalAmount,
      status: autoApply ? 'applied' : 'issued',
      notes,
      customFields: customFields || {},
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    // If applied, reduce invoice balance & customer outstanding balance
    if (autoApply) {
      const reduction = Math.min(invoice.amountDue, totalAmount);
      invoice.amountDue = Math.max(0, Math.round((invoice.amountDue - reduction) * 100) / 100);
      if (invoice.amountDue === 0 && invoice.amountPaid > 0) invoice.status = 'paid';
      await invoice.save();

      await CustomerModel.findByIdAndUpdate(invoice.customerId, {
        $inc: { outstandingBalance: -reduction },
      });
    }

    await logAuditEvent({
      organizationId: orgId,
      userId,
      userEmail: req.tenant!.email,
      action: 'CREATE_CREDIT_NOTE',
      entityType: 'CreditNote',
      entityId: String(creditNote._id),
      details: { creditNoteNumber, originalInvoice: invoice.invoiceNumber, totalAmount },
    });

    res.status(201).json({ success: true, data: creditNote });
  } catch (err) {
    next(err);
  }
}
