import mongoose, { Schema, Document } from 'mongoose';

export interface IApprovalQueueDoc extends Document {
  organizationId: mongoose.Types.ObjectId;
  entityType: 'invoice' | 'credit_note' | 'payment_refund';
  entityId: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId;
  requestedByEmail: string;
  reason: string;
  details: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedByEmail?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApprovalQueueSchema = new Schema<IApprovalQueueDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    entityType: {
      type: String,
      enum: ['invoice', 'credit_note', 'payment_refund'],
      required: true,
      index: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestedByEmail: { type: String, required: true },
    reason: { type: String, required: true },
    details: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedByEmail: String,
    reviewedAt: Date,
    reviewNotes: String,
  },
  { timestamps: true }
);

ApprovalQueueSchema.index({ organizationId: 1, status: 1 });
ApprovalQueueSchema.index({ organizationId: 1, entityType: 1, entityId: 1 });

export const ApprovalQueueModel = mongoose.model<IApprovalQueueDoc>('ApprovalQueue', ApprovalQueueSchema);
