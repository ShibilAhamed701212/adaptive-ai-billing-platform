import mongoose, { Schema, Document } from 'mongoose';

export interface IPlan extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  price: number;
  billingInterval: 'monthly' | 'yearly';
  features: string[];
  limits: Record<string, number>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema = new Schema<IPlan>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    billingInterval: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    features: { type: [String], default: [] },
    limits: { type: Map, of: Number, default: {} },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const PlanModel = mongoose.model<IPlan>('Plan', PlanSchema);
