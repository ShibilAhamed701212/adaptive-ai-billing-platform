import mongoose, { Schema, Document } from 'mongoose';
import { Invoice as IInvoiceData } from '@billing/shared';

export interface IInvoiceDoc extends Document, Omit<IInvoiceData, '_id' | 'organizationId' | 'customerId' | 'createdBy'> {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
}

const InvoiceItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    sku: String,
    description: { type: String, required: true },
    unit: { type: String, default: 'unit' },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0 },
    discountPercentage: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    hsnSacCode: String,
    lineTotal: { type: Number, required: true },
    customFields: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: true }
);

const TaxBreakdownSchema = new Schema(
  {
    taxType: { type: String, required: true },
    rate: { type: Number, required: true },
    taxableAmount: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
  },
  { _id: false }
);

const InvoiceSchema = new Schema<IInvoiceDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    invoiceNumber: { type: String, required: true, trim: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerSnapshot: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: String,
      companyName: String,
      gstinOrTaxId: String,
      billingAddress: {
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
      },
    },
    issueDate: { type: String, required: true },
    dueDate: { type: String, required: true },
    currency: { type: String, default: 'INR' },
    currencySymbol: { type: String, default: '₹' },
    items: [InvoiceItemSchema],
    subtotal: { type: Number, required: true },
    discountTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    taxBreakdown: [TaxBreakdownSchema],
    grandTotal: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, required: true },
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'sent', 'partially_paid', 'paid', 'overdue', 'void', 'cancelled'],
      default: 'draft',
      index: true,
    },
    notes: String,
    terms: String,
    customFields: { type: Schema.Types.Mixed, default: {} },
    paymentHistory: [
      {
        paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
        amount: Number,
        paymentDate: String,
        method: String,
        reference: String,
      },
    ],
    pdfUrl: String,
    aiRiskScore: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'LOW' },
    aiRiskExplanation: String,
    predictedPaymentDate: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

InvoiceSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true });
InvoiceSchema.index({ organizationId: 1, issueDate: -1 });
InvoiceSchema.index({ organizationId: 1, dueDate: 1 });
InvoiceSchema.index({ organizationId: 1, status: 1 });

export const InvoiceModel = mongoose.model<IInvoiceDoc>('Invoice', InvoiceSchema);
