import mongoose, { Schema, Document } from 'mongoose';
import { CustomFieldDefinition as ICustomFieldData } from '@billing/shared';

export interface ICustomFieldDoc extends Document, Omit<ICustomFieldData, '_id' | 'organizationId'> {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
}

const CustomFieldSchema = new Schema<ICustomFieldDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    targetEntity: {
      type: String,
      enum: ['customer', 'product', 'invoice', 'invoice_item', 'payment'],
      required: true,
      index: true,
    },
    fieldName: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    fieldType: {
      type: String,
      enum: ['text', 'number', 'boolean', 'date', 'select', 'multiselect', 'textarea'],
      required: true,
    },
    required: { type: Boolean, default: false },
    defaultValue: { type: Schema.Types.Mixed },
    options: [{ type: String }],
    placeholder: { type: String },
    validationRegex: { type: String },
    isSearchable: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CustomFieldSchema.index({ organizationId: 1, targetEntity: 1, fieldName: 1 }, { unique: true });

export const CustomFieldModel = mongoose.model<ICustomFieldDoc>('CustomFieldDefinition', CustomFieldSchema);
