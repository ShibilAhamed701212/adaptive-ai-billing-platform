import { z } from 'zod';

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  amount: z.number().positive('Amount must be a positive number'),
  paymentMethod: z.enum(['bank_transfer', 'credit_card', 'debit_card', 'upi', 'cash', 'stripe', 'razorpay', 'cheque', 'other']).optional().default('bank_transfer'),
  paymentDate: z.string().optional(),
  transactionReference: z.string().max(200).optional(),
  // Client-supplied dedup key so retried requests never create duplicate financial
  // records (enforced by the unique partial index on {organizationId, idempotencyKey}).
  idempotencyKey: z.string().min(8).max(100).optional(),
  notes: z.string().max(2000).optional(),
  customFields: z.record(z.any()).optional().default({}),
});

export const refundPaymentSchema = z.object({
  amount: z.number().positive('Refund amount must be positive').optional(), // if omitted, full refund
  reason: z.string().min(1, 'Refund reason is required').max(1000),
  notes: z.string().max(2000).optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
