import { z } from 'zod';

const pricingTierSchema = z.object({
  minQuantity: z.number().min(1),
  maxQuantity: z.number().optional(),
  unitPrice: z.number().min(0),
});

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200).trim(),
  sku: z.string().min(1, 'SKU is required').max(50).trim(),
  description: z.string().max(2000).optional(),
  type: z.enum(['goods', 'service', 'subscription', 'usage']).optional().default('goods'),
  unit: z.string().max(30).optional().default('unit'),
  unitPrice: z.number().min(0, 'Unit price must be non-negative'),
  costPrice: z.number().min(0).optional().default(0),
  taxRate: z.number().min(0).max(1).optional().default(0.18),
  hsnSacCode: z.string().max(20).optional(),
  pricingTiers: z.array(pricingTierSchema).optional().default([]),
  customFields: z.record(z.any()).optional().default({}),
  barcode: z.string().optional(),
  stockQuantity: z.number().optional().default(0),
  lowStockThreshold: z.number().optional().default(5),
  manageInventory: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).optional(),
  type: z.enum(['goods', 'service', 'subscription', 'usage']).optional(),
  unit: z.string().max(30).optional(),
  unitPrice: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  taxRate: z.number().min(0).default(0.18),
  hsnSacCode: z.string().optional(),
  pricingTiers: z.array(pricingTierSchema).optional(),
  customFields: z.record(z.any()).optional().default({}),
  isActive: z.boolean().optional().default(true),
  barcode: z.string().optional(),
  stockQuantity: z.number().optional().default(0),
  lowStockThreshold: z.number().optional().default(5),
  manageInventory: z.boolean().optional().default(false),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
