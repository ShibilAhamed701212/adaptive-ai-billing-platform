import mongoose, { Schema, Document } from 'mongoose';

export interface IHeldBillDoc extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  cashierId: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId;
  customerName?: string;
  holdReference: string;
  items: Array<{
    productId: mongoose.Types.ObjectId;
    sku: string;
    name: string;
    unitPrice: number;
    cartQuantity: number;
    lineDiscount?: number;
    taxRate: number;
    barcode?: string;
    stockQuantity?: number;
  }>;
  notes?: string;
  heldAt: Date;
}

const HeldBillSchema = new Schema<IHeldBillDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    cashierId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String, default: 'Walk-in Customer' },
    holdReference: { type: String, required: true },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        sku: String,
        name: String,
        unitPrice: Number,
        cartQuantity: Number,
        lineDiscount: Number,
        taxRate: Number,
        barcode: String,
        stockQuantity: Number,
      },
    ],
    notes: String,
    heldAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

HeldBillSchema.index({ organizationId: 1, cashierId: 1 });
HeldBillSchema.index({ organizationId: 1, heldAt: -1 });

export const HeldBillModel = mongoose.model<IHeldBillDoc>('HeldBill', HeldBillSchema);
