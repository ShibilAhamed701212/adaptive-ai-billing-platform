export type UserRole = 'admin' | 'manager' | 'accountant' | 'sales' | 'viewer';

export interface User {
  _id: string;
  organizationId: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationSettings {
  currency: string;
  currencySymbol: string;
  timezone: string;
  dateFormat: string;
  taxSystem: 'GST' | 'VAT' | 'SALES_TAX' | 'NONE';
  invoicePrefix: string;
  nextInvoiceNumber: number;
  paymentTermsDays: number;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  gstinOrTaxId?: string;
  website?: string;
}

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  billingModel: BillingModelType;
  enabledModules: string[];
  settings: OrganizationSettings;
  createdAt: string;
  updatedAt: string;
}

export type BillingModelType =
  | 'retail'
  | 'subscription'
  | 'usage_based'
  | 'rental'
  | 'professional_services'
  | 'healthcare'
  | 'logistics'
  | 'custom';

export interface TenantContext {
  organizationId: string;
  userId: string;
  role: UserRole;
  email: string;
}
