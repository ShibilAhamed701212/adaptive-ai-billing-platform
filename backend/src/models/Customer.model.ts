import mongoose, { Schema, Document } from 'mongoose';
import { Customer as ICustomerData } from '@billing/shared';

export interface ICustomerDoc extends Document, Omit<ICustomerData, '_id' | 'organizationId'> {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
}

const CustomerSchema = new Schema<ICustomerDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    companyName: { type: String, trim: true },
    gstinOrTaxId: { type: String, trim: true },
    billingAddress: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: { type: String, default: 'India' },
    },
    shippingAddress: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    creditLimit: { type: Number, default: 0 },
    outstandingBalance: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    tags: [{ type: String, trim: true }],
    customFields: { type: Schema.Types.Mixed, default: {} },
    notes: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ organizationId: 1, name: 1 });
CustomerSchema.index({ organizationId: 1, email: 1 });
CustomerSchema.index({ organizationId: 1, gstinOrTaxId: 1 });

export const CustomerModel = mongoose.model<ICustomerDoc>('Customer', CustomerSchema);
