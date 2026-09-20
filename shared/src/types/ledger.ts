export type LedgerTransactionType = 'SALE' | 'PAYMENT' | 'REFUND' | 'ADJUSTMENT' | 'RETURN';

export interface LedgerTransaction {
  _id: string;
  organizationId: string;
  customerId: string;
  type: LedgerTransactionType;
  amount: number; // positive for increasing customer debt, negative for payment (decreasing debt)
  balanceAfter: number;
  referenceId?: string; // invoiceId, paymentId, returnId
  referenceModel?: 'Invoice' | 'Payment' | 'Return';
  notes?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreCreditTransaction {
  _id: string;
  organizationId: string;
  customerId: string;
  type: 'ISSUE' | 'REDEMPTION' | 'EXPIRE' | 'ADJUSTMENT';
  amount: number; // positive for issue, negative for redemption
  balanceAfter: number;
  referenceId?: string;
  referenceModel?: 'Invoice' | 'Payment' | 'Return';
  notes?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
