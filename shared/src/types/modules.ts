import type { BillingModelType } from './auth';

export type BusinessType = 'retail' | 'saas' | 'services' | 'general';

/**
 * Canonical module keys stored on Organization.enabledModules.
 * A module key present in the array means the organization may use that module.
 */
export const ALL_MODULES = [
  'invoices',
  'customers',
  'products',
  'payments',
  'reports',
  'ai_copilot',
  'subscriptions',
  'pos',
  'inventory',
  'purchases',
  'suppliers',
  'returns',
  'shifts',
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
    'purchases',
    'suppliers',
    'returns',
    'shifts',
    'expenses',
    'customers',
    'products',
    'invoices',
    'payments',
    'reports',
    'ai_copilot',
  ],
  saas: [
    'subscriptions',
    'customers',
    'products',
    'invoices',
    'payments',
    'reports',
    'ai_copilot',
  ],
  services: [
    'customers',
    'products',
    'invoices',
    'payments',
    'reports',
    'ai_copilot',
  ],
  general: [
    'invoices',
    'customers',
    'products',
    'payments',
    'reports',
    'ai_copilot',
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
