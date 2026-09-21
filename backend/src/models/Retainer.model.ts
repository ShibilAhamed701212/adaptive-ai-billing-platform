import mongoose, { Schema, Document } from 'mongoose';

export interface IRetainer extends Document {
  organizationId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  amount: number;
  remainingBalance: number;
  billingPeriod: 'monthly' | 'quarterly' | 'annual';
  status: 'active' | 'exhausted' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const RetainerSchema = new Schema<IRetainer>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    amount: { type: Number, required: true },
    remainingBalance: { type: Number, required: true },
    billingPeriod: { type: String, enum: ['monthly', 'quarterly', 'annual'], default: 'monthly' },
    status: { type: String, enum: ['active', 'exhausted', 'cancelled'], default: 'active' },
  },
  { timestamps: true }
);

export const RetainerModel = mongoose.model<IRetainer>('Retainer', RetainerSchema);
