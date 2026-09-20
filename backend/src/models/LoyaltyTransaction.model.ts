import mongoose, { Schema, Document } from 'mongoose';

export interface ILoyaltyTransactionDoc extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  type: 'ACCRUAL' | 'REDEMPTION' | 'ADJUSTMENT' | 'EXPIRE';
  points: number; // positive for accrual, negative for redemption
  pointsValueInRupees: number; // rupee equivalent
  balanceAfter: number;
  referenceId?: string;
  referenceModel?: string;
  notes?: string;
}

const LoyaltyTransactionSchema = new Schema<ILoyaltyTransactionDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    type: {
      type: String,
      enum: ['ACCRUAL', 'REDEMPTION', 'ADJUSTMENT', 'EXPIRE'],
      required: true,
    },
    points: { type: Number, required: true },
    pointsValueInRupees: { type: Number, default: 0 },
    balanceAfter: { type: Number, required: true },
    referenceId: { type: String },
    referenceModel: { type: String },
    notes: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const LoyaltyTransactionModel = mongoose.model<ILoyaltyTransactionDoc>('LoyaltyTransaction', LoyaltyTransactionSchema);
