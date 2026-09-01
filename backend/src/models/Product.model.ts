import mongoose, { Schema, Document } from 'mongoose';
import { Product as IProductData } from '@billing/shared';

export interface IProductDoc extends Document, Omit<IProductData, '_id' | 'organizationId'> {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
}

const ProductSchema = new Schema<IProductDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String },
    type: {
      type: String,
      enum: ['goods', 'service', 'subscription', 'usage'],
      default: 'goods',
    },
    unit: { type: String, default: 'unit' },
    unitPrice: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0.18 }, // default 18%
    hsnSacCode: { type: String, trim: true },
    pricingTiers: [
      {
        minQuantity: { type: Number, required: true },
        maxQuantity: { type: Number },
        unitPrice: { type: Number, required: true },
      },
    ],
    customFields: { type: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ProductSchema.index({ organizationId: 1, sku: 1 }, { unique: true });
ProductSchema.index({ organizationId: 1, name: 1 });

export const ProductModel = mongoose.model<IProductDoc>('Product', ProductSchema);
