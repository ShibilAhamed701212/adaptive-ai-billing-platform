import { Request, Response, NextFunction } from 'express';
import { PaymentModel } from '../../models/Payment.model';
import { InvoiceModel } from '../../models/Invoice.model';
import { CustomerModel } from '../../models/Customer.model';
import { logAuditEvent } from '../../core/audit/audit.service';
import mongoose from 'mongoose';

export async function listPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { invoiceId, customerId, page = 1, limit = 50 } = req.query;

    const query: any = { organizationId: new mongoose.Types.ObjectId(orgId) };
    if (invoiceId) {
      query.invoiceId = new mongoose.Types.ObjectId(String(invoiceId));
    }
    if (customerId) {
      query.customerId = new mongoose.Types.ObjectId(String(customerId));
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [payments, total] = await Promise.all([
      PaymentModel.find(query).sort({ paymentDate: -1 }).skip(skip).limit(Number(limit)),
      PaymentModel.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: payments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
        hasMore: skip + payments.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function recordPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { invoiceId, amount, paymentMethod, paymentDate, transactionReference, notes, customFields, idempotencyKey } = req.body;

    if (!invoiceId || !amount || Number(amount) <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invoice ID and valid positive amount are required' },
      });
      return;
    }

    if (idempotencyKey) {
      const existingPayment = await PaymentModel.findOne({
        organizationId: new mongoose.Types.ObjectId(orgId),
        idempotencyKey,
      });
      if (existingPayment) {
        const existingInvoice = await InvoiceModel.findById(existingPayment.invoiceId);
        res.status(200).json({
          success: true,
          data: {
            payment: existingPayment,
            invoice: existingInvoice ? {
              _id: existingInvoice._id,
              amountPaid: existingInvoice.amountPaid,
              amountDue: existingInvoice.amountDue,
              status: existingInvoice.status,
            } : null,
          },
        });
        return;
      }
    }

    const invoice = await InvoiceModel.findOne({
      _id: invoiceId,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      return;
    }

    const paymentAmount = Number(amount);

    // Create payment entry
    const payment = await PaymentModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      invoiceId: invoice._id,
      customerId: invoice.customerId,
      amount: paymentAmount,
      currency: invoice.currency,
      paymentDate: paymentDate || new Date().toISOString().split('T')[0],
      paymentMethod: paymentMethod || 'bank_transfer',
      transactionReference,
      status: 'completed',
      notes,
      idempotencyKey,
      customFields: customFields || {},
    });

    // Update invoice totals & status
    const updatedPaid = Math.round((invoice.amountPaid + paymentAmount) * 100) / 100;
    const updatedDue = Math.max(0, Math.round((invoice.grandTotal - updatedPaid) * 100) / 100);
    const newStatus = updatedDue === 0 ? 'paid' : 'partially_paid';

    invoice.amountPaid = updatedPaid;
    invoice.amountDue = updatedDue;
    invoice.status = newStatus;
    if (!invoice.paymentHistory) invoice.paymentHistory = [];
    invoice.paymentHistory.push({
      paymentId: String(payment._id),
      amount: paymentAmount,
      paymentDate: payment.paymentDate,
      method: payment.paymentMethod,
      reference: payment.transactionReference,
    });
    await invoice.save();

    // Deduct from customer's outstanding balance
    await CustomerModel.findByIdAndUpdate(invoice.customerId, {
      $inc: { outstandingBalance: -paymentAmount },
    });

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'RECORD_PAYMENT',
      entityType: 'Payment',
      entityId: String(payment._id),
      details: { invoiceId, invoiceNumber: invoice.invoiceNumber, amount: paymentAmount, method: paymentMethod },
    });

    res.status(201).json({
      success: true,
      data: {
        payment,
        invoice: {
          _id: invoice._id,
          amountPaid: invoice.amountPaid,
          amountDue: invoice.amountDue,
          status: invoice.status,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function refundPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const paymentId = req.params.id;
    const { amount, reason, notes } = req.body;

    const payment = await PaymentModel.findOne({
      _id: paymentId,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!payment) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } });
      return;
    }

    if (payment.status === 'refunded') {
      res.status(400).json({ success: false, error: { code: 'ALREADY_REFUNDED', message: 'Payment has already been refunded' } });
      return;
    }

    const refundAmount = amount ? Math.min(payment.amount, Number(amount)) : payment.amount;

    const invoice = await InvoiceModel.findById(payment.invoiceId);
    if (invoice) {
      invoice.amountPaid = Math.max(0, Math.round((invoice.amountPaid - refundAmount) * 100) / 100);
      invoice.amountDue = Math.min(invoice.grandTotal, Math.round((invoice.amountDue + refundAmount) * 100) / 100);
      invoice.status = invoice.amountPaid === 0 ? 'sent' : 'partially_paid';
      await invoice.save();

      // Increase customer outstanding balance back
      await CustomerModel.findByIdAndUpdate(invoice.customerId, {
        $inc: { outstandingBalance: refundAmount },
      });
    }

    payment.status = refundAmount === payment.amount ? 'refunded' : 'completed';
    payment.notes = (payment.notes ? `${payment.notes} | ` : '') + `Refunded ₹${refundAmount}: ${reason || 'N/A'}`;
    await payment.save();

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'REFUND_PAYMENT',
      entityType: 'Payment',
      entityId: String(payment._id),
      details: { refundAmount, reason, invoiceNumber: invoice?.invoiceNumber },
    });

    res.json({
      success: true,
      message: `Successfully refunded ₹${refundAmount.toLocaleString()}`,
      data: {
        payment,
        invoice: invoice
          ? {
              _id: invoice._id,
              amountPaid: invoice.amountPaid,
              amountDue: invoice.amountDue,
              status: invoice.status,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function testCheckout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { invoiceId, amount } = req.body;

    const invoice = await InvoiceModel.findOne({
      _id: invoiceId,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found in test checkout' } });
      return;
    }

    const paymentAmount = Number(amount) || invoice.amountDue;

    const payment = await PaymentModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      invoiceId: invoice._id,
      customerId: invoice.customerId,
      amount: paymentAmount,
      currency: invoice.currency,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'test_sandbox',
      transactionReference: 'TEST-' + Math.random().toString(36).substring(7),
      status: 'completed',
      notes: 'Sandbox Test Payment',
    });

    const updatedPaid = Math.round((invoice.amountPaid + paymentAmount) * 100) / 100;
    const updatedDue = Math.max(0, Math.round((invoice.grandTotal - updatedPaid) * 100) / 100);
    const newStatus = updatedDue === 0 ? 'paid' : 'partially_paid';

    invoice.amountPaid = updatedPaid;
    invoice.amountDue = updatedDue;
    invoice.status = newStatus;
    if (!invoice.paymentHistory) invoice.paymentHistory = [];
    invoice.paymentHistory.push({
      paymentId: String(payment._id),
      amount: paymentAmount,
      paymentDate: payment.paymentDate,
      method: payment.paymentMethod,
      reference: payment.transactionReference,
    });
    await invoice.save();

    res.status(200).json({
      success: true,
      message: 'Sandbox payment processed successfully',
      data: {
        payment,
        invoiceStatus: newStatus
      }
    });
  } catch (err) {
    next(err);
  }
}
