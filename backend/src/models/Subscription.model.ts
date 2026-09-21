import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscription extends Document {
  organizationId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  startDate: Date;
  renewalDate: Date;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';
  trialEnd?: Date;
  cancelDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
    startDate: { type: Date, required: true },
    renewalDate: { type: Date, required: true },
    status: { type: String, enum: ['active', 'trialing', 'past_due', 'canceled', 'unpaid'], default: 'active' },
    trialEnd: { type: Date },
    cancelDate: { type: Date },
  },
  { timestamps: true }
);

export const SubscriptionModel = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
