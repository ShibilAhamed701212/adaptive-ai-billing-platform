import mongoose, { Schema, Document } from 'mongoose';
import { UserRole, MembershipStatus } from '@billing/shared';

export interface IMembershipDoc extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  role: UserRole;
  status: MembershipStatus;
  createdAt: Date;
  updatedAt: Date;
}

const MembershipSchema = new Schema<IMembershipDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    role: {
      type: String,
      enum: ['admin', 'manager', 'accountant', 'sales', 'viewer'],
      default: 'viewer',
    },
    status: {
      type: String,
      enum: ['active', 'invited', 'disabled'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// A user can only have one membership per organization.
MembershipSchema.index({ userId: 1, organizationId: 1 }, { unique: true });
MembershipSchema.index({ organizationId: 1, status: 1 });

export const MembershipModel = mongoose.model<IMembershipDoc>('Membership', MembershipSchema);
