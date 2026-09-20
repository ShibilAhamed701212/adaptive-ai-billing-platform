export type InventoryMovementType = 'PURCHASE' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'DAMAGE' | 'EXPIRY' | 'CORRECTION' | 'TRANSFER';

export interface InventoryMovement {
  _id: string;
  organizationId: string;
  productId: string;
  type: InventoryMovementType;
  quantity: number; // positive for addition, negative for deduction
  previousStock: number;
  newStock: number;
  referenceId?: string; // invoiceId, purchaseId, returnId, etc.
  referenceModel?: 'Invoice' | 'Purchase' | 'Return' | 'Adjustment';
  notes?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
