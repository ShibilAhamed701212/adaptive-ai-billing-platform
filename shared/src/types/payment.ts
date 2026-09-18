export type PaymentMethod =
  | 'bank_transfer'
  | 'credit_card'
  | 'debit_card'
  | 'upi'
  | 'cash'
  | 'stripe'
  | 'razorpay'
  | 'cheque'
  | 'other';

export type PaymentStatus = 'completed' | 'pending' | 'failed' | 'refunded';

export interface Payment {
  _id: string;
  organizationId: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  currency: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  status: PaymentStatus;
  notes?: string;
  idempotencyKey?: string;
  customFields?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
