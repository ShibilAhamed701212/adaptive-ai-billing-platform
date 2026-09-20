import mongoose, { Schema, Document } from 'mongoose';
import { InventoryMovement as IInventoryMovementData } from '@billing/shared';

export interface IInventoryMovementDoc extends Document, Omit<IInventoryMovementData, '_id' | 'organizationId' | 'productId' | 'userId'> {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
}

const InventoryMovementSchema = new Schema<IInventoryMovementDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    type: {
      type: String,
      enum: ['PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'DAMAGE', 'EXPIRY', 'CORRECTION', 'TRANSFER'],
      required: true,
    },
    quantity: { type: Number, required: true },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    referenceId: { type: String },
    referenceModel: { type: String },
    notes: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const InventoryMovementModel = mongoose.model<IInventoryMovementDoc>('InventoryMovement', InventoryMovementSchema);
