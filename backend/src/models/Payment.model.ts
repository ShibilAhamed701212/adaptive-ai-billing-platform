import mongoose, { Schema, Document } from 'mongoose';
import { Payment as IPaymentData } from '@billing/shared';

export interface IPaymentDoc extends Document, Omit<IPaymentData, '_id' | 'organizationId' | 'invoiceId' | 'customerId'> {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  refundedAmount: number;
}

const PaymentSchema = new Schema<IPaymentDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: false, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    paymentDate: { type: String, required: true },
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'credit_card', 'debit_card', 'upi', 'cash', 'card', 'store_credit', 'loyalty_points', 'stripe', 'razorpay', 'cheque', 'sandbox', 'test_sandbox', 'other'],
      default: 'cash',
    },
    transactionReference: String,
    status: {
      type: String,
      enum: ['completed', 'pending', 'failed', 'refunded'],
      default: 'completed',
    },
    // Cumulative amount refunded against this payment (partial refunds), so repeated
    // partial refunds can never exceed the original payment amount.
    refundedAmount: { type: Number, default: 0, min: 0 },
    notes: String,
    idempotencyKey: { type: String, sparse: true },
    customFields: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

PaymentSchema.index({ organizationId: 1, paymentDate: -1 });
PaymentSchema.index(
  { organizationId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

export const PaymentModel = mongoose.model<IPaymentDoc>('Payment', PaymentSchema);
