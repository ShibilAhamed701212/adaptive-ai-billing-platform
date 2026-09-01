import mongoose, { Schema, Document } from 'mongoose';
import { BusinessRule as IBusinessRuleData } from '@billing/shared';

export interface IBusinessRuleDoc extends Document, Omit<IBusinessRuleData, '_id' | 'organizationId'> {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
}

const BusinessRuleSchema = new Schema<IBusinessRuleDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    ruleName: { type: String, required: true, trim: true },
    description: { type: String },
    event: {
      type: String,
      enum: ['beforeInvoiceCalculate', 'onInvoiceCreate', 'onPaymentReceive', 'onInvoiceSent'],
      required: true,
      index: true,
    },
    condition: {
      field: { type: String, required: true },
      operator: {
        type: String,
        enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'in'],
        required: true,
      },
      value: { type: Schema.Types.Mixed, required: true },
    },
    action: {
      type: {
        type: String,
        enum: ['apply_discount', 'add_surcharge', 'require_approval', 'tag_customer', 'set_field'],
        required: true,
      },
      targetField: { type: String },
      value: { type: Schema.Types.Mixed, required: true },
      message: { type: String },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

BusinessRuleSchema.index({ organizationId: 1, event: 1 });

export const BusinessRuleModel = mongoose.model<IBusinessRuleDoc>('BusinessRule', BusinessRuleSchema);
