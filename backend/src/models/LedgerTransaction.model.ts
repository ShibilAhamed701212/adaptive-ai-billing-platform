import mongoose, { Schema, Document } from 'mongoose';
import { LedgerTransaction as ILedgerData } from '@billing/shared';

export interface ILedgerTransactionDoc extends Document, Omit<ILedgerData, '_id' | 'organizationId' | 'customerId'> {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
}

const LedgerTransactionSchema = new Schema<ILedgerTransactionDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    type: {
      type: String,
      enum: ['SALE', 'PAYMENT', 'REFUND', 'ADJUSTMENT', 'RETURN'],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    referenceId: { type: String },
    referenceModel: { type: String },
    notes: { type: String },
    date: { type: String, required: true },
  },
  { timestamps: true }
);

export const LedgerTransactionModel = mongoose.model<ILedgerTransactionDoc>('LedgerTransaction', LedgerTransactionSchema);
