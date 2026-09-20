import mongoose, { Schema, Document } from 'mongoose';

export interface IReturnItem {
  productId: mongoose.Types.ObjectId;
  sku?: string;
  name: string;
  quantityReturned: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  refundTotal: number;
  reason?: string;
  restock: boolean;
}

export interface IReturnDoc extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  returnNumber: string;
  date: string;
  items: IReturnItem[];
  totalRefundAmount: number;
  refundMethod: 'cash' | 'card' | 'upi' | 'store_credit' | 'customer_balance';
  isExchange: boolean;
  exchangeDetails?: {
    newItemsTotal: number;
    difference: number;
    differenceSettledVia?: string;
  };
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ReturnItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: String,
    name: { type: String, required: true },
    quantityReturned: { type: Number, required: true, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    refundTotal: { type: Number, required: true },
    reason: { type: String, default: 'Customer return' },
    restock: { type: Boolean, default: true },
  },
  { _id: true }
);

const ReturnSchema = new Schema<IReturnDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    returnNumber: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    items: [ReturnItemSchema],
    totalRefundAmount: { type: Number, required: true },
    refundMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'store_credit', 'customer_balance'],
      required: true,
    },
    isExchange: { type: Boolean, default: false },
    exchangeDetails: {
      newItemsTotal: Number,
      difference: Number,
      differenceSettledVia: String,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

ReturnSchema.index({ organizationId: 1, returnNumber: 1 });
ReturnSchema.index({ organizationId: 1, invoiceId: 1 });
ReturnSchema.index({ organizationId: 1, date: -1 });

export const ReturnModel = mongoose.model<IReturnDoc>('Return', ReturnSchema);
