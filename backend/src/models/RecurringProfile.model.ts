import mongoose, { Schema, Document } from 'mongoose';

export interface IRecurringProfileDoc extends Document {
  organizationId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  profileName: string;
  items: {
    productId?: mongoose.Types.ObjectId;
    description: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    hsnSacCode?: string;
  }[];
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  nextRunDate: Date;
  lastRunDate?: Date;
  startDate: Date;
  endDate?: Date;
  totalGeneratedCount: number;
  maxOccurrences?: number;
  autoSend: boolean;
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  invoiceDiscountAmount: number;
  notes?: string;
  terms?: string;
  customFields: Record<string, any>;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RecurringItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    description: { type: String, required: true },
    unit: { type: String, default: 'unit' },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: 0 },
    hsnSacCode: String,
  },
  { _id: false }
);

const RecurringProfileSchema = new Schema<IRecurringProfileDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    profileName: { type: String, required: true, trim: true },
    items: { type: [RecurringItemSchema], required: true },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semi_annual', 'annual'],
      required: true,
    },
    nextRunDate: { type: Date, required: true, index: true },
    lastRunDate: { type: Date },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    totalGeneratedCount: { type: Number, default: 0 },
    maxOccurrences: { type: Number },
    autoSend: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['active', 'paused', 'cancelled', 'completed'],
      default: 'active',
      index: true,
    },
    invoiceDiscountAmount: { type: Number, default: 0 },
    notes: String,
    terms: String,
    customFields: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

RecurringProfileSchema.index({ organizationId: 1, status: 1, nextRunDate: 1 });

export const RecurringProfileModel = mongoose.model<IRecurringProfileDoc>('RecurringProfile', RecurringProfileSchema);
