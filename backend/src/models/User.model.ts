import mongoose, { Schema, Document } from 'mongoose';
import { User as IUserData, UserRole } from '@billing/shared';

export interface IUserDoc extends Document, Omit<IUserData, '_id' | 'organizationId'> {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  passwordHash: string;
}

const UserSchema = new Schema<IUserDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['admin', 'manager', 'accountant', 'sales', 'viewer'],
      default: 'admin',
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Unique email per organization
UserSchema.index({ organizationId: 1, email: 1 }, { unique: true });

export const UserModel = mongoose.model<IUserDoc>('User', UserSchema);
