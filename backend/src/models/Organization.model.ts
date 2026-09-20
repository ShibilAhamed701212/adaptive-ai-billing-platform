import mongoose, { Schema, Document } from 'mongoose';
import { Organization as IOrgData } from '@billing/shared';

export interface IOrganizationDoc extends Document, Omit<IOrgData, '_id'> {
  _id: mongoose.Types.ObjectId;
}

const OrganizationSchema = new Schema<IOrganizationDoc>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    billingModel: {
      type: String,
      enum: ['retail', 'subscription', 'usage_based', 'rental', 'professional_services', 'healthcare', 'logistics', 'custom'],
      default: 'retail',
    },
    enabledModules: {
      type: [String],
      default: ['invoices', 'customers', 'products', 'payments', 'reports', 'ai_copilot'],
    },
    businessType: {
      type: String,
      enum: ['retail', 'saas', 'services', 'general'],
      default: 'general',
    },
    settings: {
      currency: { type: String, default: 'INR' },
      currencySymbol: { type: String, default: '₹' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      dateFormat: { type: String, default: 'DD/MM/YYYY' },
      taxSystem: { type: String, enum: ['GST', 'VAT', 'SALES_TAX', 'NONE'], default: 'GST' },
      invoicePrefix: { type: String, default: 'INV' },
      nextInvoiceNumber: { type: Number, default: 1001 },
      paymentTermsDays: { type: Number, default: 30 },
      logoUrl: { type: String },
      primaryColor: { type: String, default: '#6366f1' },
      accentColor: { type: String, default: '#10b981' },
      address: {
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
      },
      gstinOrTaxId: String,
      website: String,
    },
    isOnboarded: { type: Boolean, default: false },
    onboarding: {
      currentStep: { type: Number, default: 1 },
      completedSteps: { type: [String], default: [] },
      skipped: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

export const OrganizationModel = mongoose.model<IOrganizationDoc>('Organization', OrganizationSchema);
