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
  businessType?: 'retail' | 'saas' | 'services' | 'general';
  enabledModules: string[];
  settings: OrganizationSettings;
  isOnboarded: boolean;
  onboarding?: {
    currentStep?: number;
    completedSteps?: string[];
    skipped?: boolean;
  };
  moduleAudit?: {
    moduleId: string;
    enabledBy: 'system' | 'admin' | 'ai';
    timestamp: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export type MembershipStatus = 'active' | 'invited' | 'disabled';

export interface Membership {
  _id: string;
  userId: string;
  organizationId: string;
  organization?: Organization;
  role: UserRole;
  status: MembershipStatus;
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
