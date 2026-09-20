import mongoose, { Schema, Document } from 'mongoose';
import { StoreCreditTransaction as IStoreCreditData } from '@billing/shared';

export interface IStoreCreditTransactionDoc extends Document, Omit<IStoreCreditData, '_id' | 'organizationId' | 'customerId' | 'userId'> {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
}

const StoreCreditTransactionSchema = new Schema<IStoreCreditTransactionDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    type: {
      type: String,
      enum: ['ISSUE', 'REDEMPTION', 'EXPIRE', 'ADJUSTMENT'],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    referenceId: { type: String },
    referenceModel: { type: String },
    notes: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const StoreCreditTransactionModel = mongoose.model<IStoreCreditTransactionDoc>('StoreCreditTransaction', StoreCreditTransactionSchema);
