import mongoose, { Schema, Document } from 'mongoose';

export interface ICreditNoteDoc extends Document {
  organizationId: mongoose.Types.ObjectId;
  creditNoteNumber: string;
  originalInvoiceId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  reason: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    taxAmount: number;
    lineTotal: number;
  }[];
  subtotal: number;
  taxTotal: number;
  totalAmount: number;
  status: 'draft' | 'issued' | 'applied' | 'void';
  notes?: string;
  customFields: Record<string, any>;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CreditNoteItemSchema = new Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true },
  },
  { _id: true }
);

const CreditNoteSchema = new Schema<ICreditNoteDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    creditNoteNumber: { type: String, required: true, trim: true },
    originalInvoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    reason: { type: String, required: true, trim: true },
    items: [CreditNoteItemSchema],
    subtotal: { type: Number, required: true },
    taxTotal: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['draft', 'issued', 'applied', 'void'],
      default: 'draft',
      index: true,
    },
    notes: String,
    customFields: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

CreditNoteSchema.index({ organizationId: 1, creditNoteNumber: 1 }, { unique: true });
CreditNoteSchema.index({ organizationId: 1, originalInvoiceId: 1 });

export const CreditNoteModel = mongoose.model<ICreditNoteDoc>('CreditNote', CreditNoteSchema);
