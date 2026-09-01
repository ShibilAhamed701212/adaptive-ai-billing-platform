import { z } from 'zod';

const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional().default('India'),
}).optional();

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim(),
  email: z.string().email('Invalid email').toLowerCase().trim(),
  phone: z.string().max(20).optional(),
  companyName: z.string().max(200).optional(),
  gstinOrTaxId: z.string().max(50).optional(),
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  customFields: z.record(z.any()).optional().default({}),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().max(2000).optional(),
  creditLimit: z.number().min(0).optional().default(0),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  email: z.string().email().toLowerCase().trim().optional(),
  phone: z.string().max(20).optional(),
  companyName: z.string().max(200).optional(),
  gstinOrTaxId: z.string().max(50).optional(),
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  customFields: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional(),
  creditLimit: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
