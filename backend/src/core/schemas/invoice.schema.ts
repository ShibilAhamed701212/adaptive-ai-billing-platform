import { z } from 'zod';

const invoiceItemSchema = z.object({
  productId: z.string().optional(),
  sku: z.string().optional(),
  description: z.string().min(1, 'Item description is required').max(500),
  unit: z.string().max(30).optional().default('unit'),
  quantity: z.number().min(0.01, 'Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price must be non-negative'),
  discountAmount: z.number().min(0).optional().default(0),
  discountPercentage: z.number().min(0).max(100).optional().default(0),
  taxRate: z.number().min(0).max(1).optional().default(0),
  hsnSacCode: z.string().max(20).optional(),
  customFields: z.record(z.any()).optional().default({}),
});

export const createInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one line item is required'),
  notes: z.string().max(5000).optional(),
  terms: z.string().max(5000).optional(),
  customFields: z.record(z.any()).optional().default({}),
  invoiceDiscountAmount: z.number().min(0).optional().default(0),
  status: z.enum(['draft', 'sent']).optional().default('draft'),
});

export const updateInvoiceSchema = z.object({
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1).optional(),
  notes: z.string().max(5000).optional(),
  terms: z.string().max(5000).optional(),
  customFields: z.record(z.any()).optional(),
  invoiceDiscountAmount: z.number().min(0).optional(),
});

export const previewInvoiceSchema = z.object({
  customerId: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  invoiceDiscountAmount: z.number().min(0).optional().default(0),
  customFields: z.record(z.any()).optional(),
});

export const updateInvoiceStatusSchema = z.object({
  status: z.enum(['draft', 'pending_approval', 'approved', 'sent', 'overdue', 'void', 'cancelled']),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type PreviewInvoiceInput = z.infer<typeof previewInvoiceSchema>;
