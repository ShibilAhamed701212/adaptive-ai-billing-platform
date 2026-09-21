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

    // Failed payments must never be recorded as completed (BUG-07 pattern).
    if (req.body.status && !['completed', 'pending'].includes(req.body.status)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: "status must be 'completed' or 'pending'" },
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

    const paymentAmount = Math.round(Number(amount) * 100) / 100;

    // Overpayment guard (BUG-08): a payment can never exceed what is still owed,
    // otherwise amountDue would go negative and the customer balance would go negative.
    if (invoice.amountDue <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVOICE_NOT_PAYABLE', message: 'Invoice has no outstanding amount due' },
      });
      return;
    }
    if (paymentAmount > invoice.amountDue + 0.001) {
      res.status(400).json({
        success: false,
        error: {
          code: 'OVERPAYMENT',
          message: `Payment amount (${paymentAmount}) exceeds outstanding due (${invoice.amountDue})`,
        },
      });
      return;
    }
    // Payable statuses: the invoice must already count as a receivable, otherwise a
    // payment would settle money that was never added to the customer's outstanding
    // balance (draft/pending_approval) or revive a dead document (void/cancelled).
    if (!['approved', 'sent', 'partially_paid', 'overdue'].includes(invoice.status)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVOICE_NOT_PAYABLE', message: `Cannot pay an invoice with status '${invoice.status}'` },
      });
      return;
    }

    const paymentStatus = req.body.status || 'completed';

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
      status: paymentStatus,
      notes,
      idempotencyKey,
      customFields: customFields || {},
    });

    // Update invoice totals & status. Only completed payments move money (BUG-07):
    // pending/failed payments create a record but must not reduce the amount due.
    if (paymentStatus === 'completed') {
      // Atomic settle (concurrency guard): the conditional filter re-checks the
      // outstanding due SERVER-SIDE at write time, so two concurrent payments can never
      // both pass the earlier in-memory guard and double-settle the same invoice.
      const updated = await InvoiceModel.findOneAndUpdate(
        {
          _id: invoice._id,
          amountDue: { $gte: paymentAmount },
        },
        [
          {
            $set: {
              amountPaid: { $round: [{ $add: ['$amountPaid', paymentAmount] }, 2] },
              amountDue: {
                $round: [
                  { $max: [0, { $subtract: ['$grandTotal', { $add: ['$amountPaid', paymentAmount] }] }] },
                  2,
                ],
              },
          status: {
            $cond: [
              { $lte: [{ $subtract: ['$grandTotal', { $add: ['$amountPaid', paymentAmount] }] }, 0] },
              'paid',
              'partially_paid',
            ],
          },
          paymentHistory: {
            $concatArrays: [
              { $ifNull: ['$paymentHistory', []] },
              [
                {
                  paymentId: payment._id,
                  amount: paymentAmount,
                  paymentDate: payment.paymentDate,
                  method: payment.paymentMethod,
                  reference: payment.transactionReference,
                },
              ],
            ],
          },
        },
      },
    ],
    { new: true }
  );

      if (!updated) {
        // Lost the race: another concurrent payment consumed the outstanding due.
        // Keep the trail by marking this attempt failed rather than silently deleting it.
        payment.status = 'failed';
        payment.notes = (payment.notes ? `${payment.notes} | ` : '') + 'Rejected: invoice concurrently settled or overpaid';
        await payment.save();
        res.status(409).json({
          success: false,
          error: {
            code: 'CONCURRENT_PAYMENT_CONFLICT',
            message: 'Invoice was concurrently modified; payment not applied',
          },
        });
        return;
      }

      invoice.set(updated.toObject());

      // Deduct from customer's outstanding balance
      await CustomerModel.findByIdAndUpdate(invoice.customerId, {
        $inc: { outstandingBalance: -paymentAmount },
      });
    }

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
    if (payment.status !== 'completed') {
      res.status(400).json({
        success: false,
        error: { code: 'NOT_REFUNDABLE', message: `Cannot refund a payment with status '${payment.status}'` },
      });
      return;
    }

    // Refund guard (BUG-09): reject non-positive and over-refunds up front. Silently
    // clamping hid data-integrity bugs; explicit rejection keeps ledger consistent.
    // Cumulative tracking (BUG-16): repeated partial refunds can never refund more than
    // the original payment amount.
    const alreadyRefunded = Math.round((payment.refundedAmount || 0) * 100) / 100;
    const refundable = Math.round((payment.amount - alreadyRefunded) * 100) / 100;
    const requested = amount === undefined || amount === null ? refundable : Number(amount);
    if (!Number.isFinite(requested) || requested <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_REFUND_AMOUNT', message: 'Refund amount must be a positive number' },
      });
      return;
    }
    if (requested > refundable + 0.001) {
      res.status(400).json({
        success: false,
        error: {
          code: 'REFUND_EXCEEDS_PAYMENT',
          message: `Refund amount (${requested}) exceeds refundable balance (${refundable} of ${payment.amount}; already refunded ${alreadyRefunded})`,
        },
      });
      return;
    }

    const refundAmount = Math.round(requested * 100) / 100;

    // Tenant scoping fix (BUG-10): the invoice must be looked up scoped to the caller's
    // organization — findById alone could mutate another tenant's invoice document.
    const invoice = await InvoiceModel.findOne({
      _id: payment.invoiceId,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });
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

    payment.refundedAmount = Math.round((alreadyRefunded + refundAmount) * 100) / 100;
    payment.status = payment.refundedAmount >= payment.amount - 0.001 ? 'refunded' : 'completed';
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

import { SandboxPaymentProvider, StripePaymentProvider, IPaymentProvider } from './providers/PaymentProvider';

export async function testCheckout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { invoiceId, amount, provider = 'sandbox', idempotencyKey } = req.body;

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
            invoiceStatus: existingInvoice?.status,
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

    // Sandbox checkout enforces the same invariants as the real payment path (BUG-11):
    // payable status, outstanding due, positive amount, no overpayment.
    if (
      invoice.amountDue <= 0 ||
      !['approved', 'sent', 'partially_paid', 'overdue'].includes(invoice.status)
    ) {
      res.status(400).json({
        success: false,
        error: { code: 'INVOICE_NOT_PAYABLE', message: `Cannot pay an invoice with status '${invoice.status}'` },
      });
      return;
    }

    const requestedAmount = Number(amount);
    if (amount !== undefined && (!Number.isFinite(requestedAmount) || requestedAmount <= 0)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Payment amount must be a positive number' },
      });
      return;
    }
    const paymentAmount = Math.round((amount !== undefined ? requestedAmount : invoice.amountDue) * 100) / 100;
    if (paymentAmount > invoice.amountDue + 0.001) {
      res.status(400).json({
        success: false,
        error: {
          code: 'OVERPAYMENT',
          message: `Payment amount (${paymentAmount}) exceeds outstanding due (${invoice.amountDue})`,
        },
      });
      return;
    }

    // Use Factory pattern for provider
    let paymentProvider: IPaymentProvider;
    if (provider === 'stripe') {
      paymentProvider = new StripePaymentProvider();
      if (!paymentProvider.isConfigured()) {
        res.status(503).json({ success: false, error: { code: 'BLOCKED_CREDENTIALS_REQUIRED', message: 'Stripe credentials not configured' } });
        return;
      }
    } else {
      paymentProvider = new SandboxPaymentProvider(); // default fallback
    }

    const intent = await paymentProvider.createIntent(invoice, paymentAmount);

    if (intent.status === 'succeeded') {
      // Provider names ('Sandbox', 'Stripe') are not Payment.method enum values — map
      // them explicitly, otherwise the Payment create throws a ValidationError (BUG-11).
      const PROVIDER_METHOD_MAP: Record<string, string> = {
        Sandbox: 'other',
        Stripe: 'stripe',
      };
      const paymentMethod = PROVIDER_METHOD_MAP[paymentProvider.getProviderName()] || 'other';

      const payment = await PaymentModel.create({
        organizationId: new mongoose.Types.ObjectId(orgId),
        invoiceId: invoice._id,
        customerId: invoice.customerId,
        amount: paymentAmount,
        currency: invoice.currency,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod,
        transactionReference: intent.id,
        status: 'completed',
        idempotencyKey,
        notes: `${paymentProvider.getProviderName()} Payment Processed`,
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

      // Deduct from customer's outstanding balance
      await CustomerModel.findByIdAndUpdate(invoice.customerId, {
        $inc: { outstandingBalance: -paymentAmount },
      });

      res.status(200).json({
        success: true,
        message: `${paymentProvider.getProviderName()} payment processed successfully`,
        data: {
          payment,
          invoiceStatus: newStatus,
          intent
        }
      });
    } else {
      res.status(200).json({
        success: true,
        message: 'Intent created, requires further action',
        data: { intent }
      });
    }
  } catch (err) {
    next(err);
  }
}
