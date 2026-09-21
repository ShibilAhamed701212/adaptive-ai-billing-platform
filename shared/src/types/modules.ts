import type { BillingModelType } from './auth';

export type BusinessType = 'retail' | 'saas' | 'services' | 'general';

/**
 * Canonical module keys stored on Organization.enabledModules.
 */
export const ALL_MODULES = [
  'invoices',
  'customers', // Generalized (Clients for Agency)
  'products',
  'payments',
  'reports',
  'ai_copilot',
  
  // Retail specific
  'pos',
  'inventory',
  'purchases',
  'suppliers',
  'returns',
  'shifts',
  
  // SaaS specific
  'plans',
  'subscriptions',
  'usage',
  'churn',

  // Agency specific
  'projects',
  'services',
  'timesheets',
  'retainers',

  // General specific (can be shared)
  'expenses',
  'credit_notes',
  'approvals',
  'team',
] as const;

export type ModuleKey = (typeof ALL_MODULES)[number];

export const MODULE_PRESETS: Record<BusinessType, string[]> = {
  retail: [
    'pos',
    'inventory',
    'products',
    'customers',
    'sales',
    'invoices',
    'payments',
    'suppliers',
    'reports',
    'settings',
    'ai_copilot'
  ],
  saas: [
    'plans',
    'subscriptions',
    'customers',
    'invoices',
    'payments',
    'usage',
    'revenue',
    'churn',
    'reports',
    'settings',
    'ai_copilot'
  ],
  services: [ // Agency
    'customers', // Used as Clients
    'projects',
    'services',
    'timesheets',
    'expenses',
    'invoices',
    'payments',
    'retainers',
    'reports',
    'settings',
    'ai_copilot'
  ],
  general: [
    'products',
    'customers',
    'sales',
    'invoices',
    'payments',
    'expenses',
    'reports',
    'settings',
    'ai_copilot'
  ],
};

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  retail: 'Retail / Supermarket',
  saas: 'SaaS / Subscription',
  services: 'Agency / Professional Services',
  general: 'General Business',
};

export const BUSINESS_TYPE_BILLING_MODEL: Record<BusinessType, BillingModelType> = {
  retail: 'retail',
  saas: 'subscription',
  services: 'professional_services',
  general: 'custom',
};

export function modulesForBusinessType(businessType: BusinessType): string[] {
  return [...(MODULE_PRESETS[businessType] || MODULE_PRESETS.general)];
}
