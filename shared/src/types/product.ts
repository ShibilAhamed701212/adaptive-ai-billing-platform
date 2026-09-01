export type ProductType = 'goods' | 'service' | 'subscription' | 'usage';

export interface PricingTier {
  minQuantity: number;
  maxQuantity?: number;
  unitPrice: number;
}

export interface Product {
  _id: string;
  organizationId: string;
  name: string;
  sku: string;
  description?: string;
  type: ProductType;
  unit: string; // e.g. 'pcs', 'hours', 'months', 'km'
  unitPrice: number;
  costPrice?: number;
  taxRate: number; // e.g. 0.18 for 18%
  hsnSacCode?: string;
  pricingTiers?: PricingTier[];
  customFields: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
