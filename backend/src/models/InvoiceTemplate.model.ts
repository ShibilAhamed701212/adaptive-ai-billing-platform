import mongoose, { Schema, Document } from 'mongoose';

export interface IInvoiceTemplateDoc extends Document {
  organizationId: mongoose.Types.ObjectId;
  templateName: string;
  description?: string;
  layout: {
    showLogo: boolean;
    showGstin: boolean;
    showHsnSac: boolean;
    showCustomFields: boolean;
    showPaymentTerms: boolean;
    showNotes: boolean;
    showTaxBreakdown: boolean;
    showBankDetails: boolean;
    headerText?: string;
    footerText?: string;
    columns: string[];
    sections: string[];
  };
  brandColors: {
    primary: string;
    accent: string;
    textColor: string;
    bgColor: string;
  };
  fontFamily: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceTemplateSchema = new Schema<IInvoiceTemplateDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    templateName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    layout: {
      showLogo: { type: Boolean, default: true },
      showGstin: { type: Boolean, default: true },
      showHsnSac: { type: Boolean, default: true },
      showCustomFields: { type: Boolean, default: true },
      showPaymentTerms: { type: Boolean, default: true },
      showNotes: { type: Boolean, default: true },
      showTaxBreakdown: { type: Boolean, default: true },
      showBankDetails: { type: Boolean, default: false },
      headerText: String,
      footerText: String,
      columns: { type: [String], default: ['description', 'quantity', 'unitPrice', 'taxRate', 'lineTotal'] },
      sections: { type: [String], default: ['header', 'customerInfo', 'items', 'totals', 'notes', 'footer'] },
    },
    brandColors: {
      primary: { type: String, default: '#6366f1' },
      accent: { type: String, default: '#10b981' },
      textColor: { type: String, default: '#1e293b' },
      bgColor: { type: String, default: '#ffffff' },
    },
    fontFamily: { type: String, default: 'Inter, sans-serif' },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

InvoiceTemplateSchema.index({ organizationId: 1, templateName: 1 }, { unique: true });

export const InvoiceTemplateModel = mongoose.model<IInvoiceTemplateDoc>('InvoiceTemplate', InvoiceTemplateSchema);
