export type CustomFieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'textarea';

export type TargetEntity = 'customer' | 'product' | 'invoice' | 'invoice_item' | 'payment';

export interface CustomFieldDefinition {
  _id?: string | any;
  organizationId: string | any;
  targetEntity: TargetEntity;
  fieldName: string; // Internal key e.g. "projectCode"
  label: string;      // Display label e.g. "Project Code"
  fieldType: CustomFieldType;
  required: boolean;
  defaultValue?: any;
  options?: string[]; // for select/multiselect
  placeholder?: string;
  validationRegex?: string;
  isSearchable?: boolean;
  order: number;
}

export interface BusinessRule {
  _id?: string | any;
  organizationId: string | any;
  ruleName: string;
  description?: string;
  event: 'beforeInvoiceCalculate' | 'onInvoiceCreate' | 'onPaymentReceive' | 'onInvoiceSent';
  condition: {
    field: string;
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in';
    value: any;
  };
  action: {
    type: 'apply_discount' | 'add_surcharge' | 'require_approval' | 'tag_customer' | 'set_field';
    targetField?: string;
    value: any;
    message?: string;
  };
  isActive: boolean;
}

export interface BillingModelPreset {
  id: string;
  name: string;
  description: string;
  industry: string;
  defaultTaxSystem: 'GST' | 'VAT' | 'SALES_TAX' | 'NONE';
  defaultModules: string[];
  suggestedCustomFields: Omit<CustomFieldDefinition, 'organizationId' | '_id'>[];
  defaultRules?: Partial<BusinessRule>[];
}

export interface InvoiceTemplateLayout {
  showLogo?: boolean;
  logoUrl?: string;
  showGstin?: boolean;
  showHsnSac?: boolean;
  showCustomFields?: boolean;
  showPaymentTerms?: boolean;
  showNotes?: boolean;
  showTaxBreakdown?: boolean;
  showBankDetails?: boolean;
  bankDetails?: {
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    ifscCode?: string;
    upiId?: string;
  };
  headerText?: string;
  footerText?: string;
  columns?: string[];
  sections?: string[];
  templateStyle?: 'modern' | 'classic' | 'minimalist' | 'gst_master' | 'pos_thermal' | 'creative';
}

export interface InvoiceTemplate {
  _id?: string;
  organizationId?: string;
  templateName: string;
  description?: string;
  layout: InvoiceTemplateLayout;
  brandColors: {
    primary: string;
    accent?: string;
    textColor?: string;
    bgColor?: string;
  };
  fontFamily?: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreditNoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface CreditNote {
  _id: string;
  organizationId: string;
  creditNoteNumber: string;
  originalInvoiceId: string | any;
  customerId: string | any;
  reason: string;
  items: CreditNoteItem[];
  subtotal: number;
  taxTotal: number;
  totalAmount: number;
  status: 'draft' | 'issued' | 'applied' | 'void';
  notes?: string;
  customFields?: Record<string, any>;
  createdBy?: string | any;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringProfile {
  _id: string;
  organizationId: string;
  customerId: any;
  profileName: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  items: any[];
  nextRunDate: string;
  startDate: string;
  endDate?: string;
  maxOccurrences?: number;
  occurrencesCount?: number;
  autoSend?: boolean;
  invoiceDiscountAmount?: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  notes?: string;
  terms?: string;
  customFields?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalQueueItem {
  _id: string;
  organizationId: string;
  entityType: 'invoice' | 'discount' | 'credit_note' | 'custom_rule';
  entityId: string;
  requestedBy: any;
  requestedByEmail?: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  amount?: number;
  currency?: string;
  reviewNotes?: string;
  reviewedBy?: any;
  reviewedByEmail?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

