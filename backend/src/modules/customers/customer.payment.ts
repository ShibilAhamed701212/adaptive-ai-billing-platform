import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { CustomerModel } from '../../models/Customer.model';
import { InvoiceModel } from '../../models/Invoice.model';
import { PaymentModel } from '../../models/Payment.model';
import { LedgerTransactionModel } from '../../models/LedgerTransaction.model';
import { logAuditEvent } from '../../core/audit/audit.service';

const PAYMENT_METHODS = new Set(['bank_transfer', 'credit_card', 'debit_card', 'upi', 'cash', 'card', 'cheque', 'other']);
const OPEN_INVOICE_STATUSES = ['approved', 'sent', 'partially_paid', 'overdue'];
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Settle a customer's account balance (e.g. Udhaar). The payment is applied to their open invoices
 * oldest-first so invoice-level receivables (AR aging, statements) stay in step with the balance.
 */
export async function recordCustomerPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  const orgId = req.tenant!.organizationId;
  const userId = req.tenant!.userId;
  const customerId = req.params.id;
  const { method = 'cash', notes, reference } = req.body;
  const paymentAmount = round2(Number(req.body.amount));

  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Payment amount must be a number greater than zero' } });
    return;
  }
  const paymentMethod = PAYMENT_METHODS.has(String(method)) ? String(method) : 'other';

  const session = await mongoose.startSession();
  try {
    let result: any = null;
    await session.withTransaction(async () => {
      result = null;
      const customer = await CustomerModel.findOne({
        _id: customerId,
        organizationId: new mongoose.Types.ObjectId(orgId),
      }).session(session);
      if (!customer) {
        result = { status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } } };
        return;
      }
      const outstanding = round2(customer.outstandingBalance || 0);
      if (paymentAmount > outstanding + 0.001) {
        result = { status: 400, body: { success: false, error: { code: 'OVERPAYMENT', message: `Payment (${paymentAmount}) exceeds the outstanding balance (${outstanding})` } } };
        return;
      }

      const paymentDate = new Date().toISOString().split('T')[0];
      const openInvoices = await InvoiceModel.find({
        organizationId: new mongoose.Types.ObjectId(orgId),
        customerId: customer._id,
        status: { $in: OPEN_INVOICE_STATUSES },
        amountDue: { $gt: 0 },
      }).sort({ issueDate: 1, createdAt: 1 }).session(session);

      let remaining = paymentAmount;
      const allocations: { invoiceId: string; invoiceNumber: string; amount: number }[] = [];
      for (const invoice of openInvoices) {
        if (remaining <= 0) break;
        const applied = round2(Math.min(remaining, invoice.amountDue));
        const [payment] = await PaymentModel.create([{
          organizationId: new mongoose.Types.ObjectId(orgId),
          invoiceId: invoice._id,
          customerId: customer._id,
          amount: applied,
          currency: invoice.currency,
          paymentDate,
          paymentMethod,
          transactionReference: reference,
          status: 'completed',
          notes: notes || 'Customer account payment',
        }], { session });

        invoice.amountPaid = round2((invoice.amountPaid || 0) + applied);
        invoice.amountDue = round2(Math.max(0, invoice.grandTotal - invoice.amountPaid));
        invoice.status = invoice.amountDue <= 0 ? 'paid' : 'partially_paid';
        (invoice as any).paymentHistory = [
          ...((invoice as any).paymentHistory || []),
          { paymentId: payment._id, amount: applied, paymentDate, method: paymentMethod, reference },
        ];
        await invoice.save({ session });

        allocations.push({ invoiceId: String(invoice._id), invoiceNumber: invoice.invoiceNumber, amount: applied });
        remaining = round2(remaining - applied);
      }

      // Any remainder settles balance that isn't tied to an invoice (e.g. an opening balance).
      const balanceAfter = round2(outstanding - paymentAmount);
      customer.outstandingBalance = balanceAfter;
      await customer.save({ session });

      const [ledger] = await LedgerTransactionModel.create([{
        organizationId: new mongoose.Types.ObjectId(orgId),
        customerId: customer._id,
        type: 'PAYMENT',
        amount: -paymentAmount,
        balanceAfter,
        notes: notes || `Payment via ${paymentMethod}`,
        referenceId: reference,
        date: new Date().toISOString(),
      }], { session });

      result = { status: 200, body: { success: true, data: { customer, transaction: ledger, allocations } }, audit: { balanceAfter, allocations } };
    });

    if (result?.audit) {
      await logAuditEvent({
        organizationId: orgId,
        userId,
        userEmail: req.tenant!.email,
        action: 'CUSTOMER_PAYMENT',
        entityType: 'Customer',
        entityId: String(customerId),
        details: { amount: paymentAmount, method: paymentMethod, reference, ...result.audit },
      });
    }
    res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  } finally {
    await session.endSession();
  }
}
