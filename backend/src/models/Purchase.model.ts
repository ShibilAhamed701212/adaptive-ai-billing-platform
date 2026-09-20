import mongoose, { Schema, Document } from 'mongoose';
import { Purchase as IPurchaseData } from '@billing/shared';

export interface IPurchaseDoc extends Document, Omit<IPurchaseData, '_id' | 'organizationId' | 'supplierId' | 'userId'> {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
}

const PurchaseItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: String,
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true },
  },
  { _id: true }
);

const PurchaseSchema = new Schema<IPurchaseDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    purchaseNumber: { type: String, required: true, trim: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    date: { type: String, required: true },
    items: [PurchaseItemSchema],
    subtotal: { type: Number, required: true },
    taxTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED'],
      default: 'RECEIVED',
      index: true,
    },
    notes: String,
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

PurchaseSchema.index({ organizationId: 1, purchaseNumber: 1 });
PurchaseSchema.index({ organizationId: 1, date: -1 });

export const PurchaseModel = mongoose.model<IPurchaseDoc>('Purchase', PurchaseSchema);
