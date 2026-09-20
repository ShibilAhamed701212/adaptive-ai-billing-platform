import mongoose, { Schema, Document } from 'mongoose';
import { Supplier as ISupplierData } from '@billing/shared';

export interface ISupplierDoc extends Document, Omit<ISupplierData, '_id' | 'organizationId'> {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
}

const SupplierSchema = new Schema<ISupplierDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    companyName: { type: String, trim: true },
    gstinOrTaxId: { type: String, trim: true },
    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: { type: String, default: 'India' },
    },
    outstandingBalance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SupplierSchema.index({ organizationId: 1, name: 1 });
SupplierSchema.index({ organizationId: 1, phone: 1 });

export const SupplierModel = mongoose.model<ISupplierDoc>('Supplier', SupplierSchema);
