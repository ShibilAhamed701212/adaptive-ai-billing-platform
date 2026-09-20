export interface Supplier {
  _id: string;
  organizationId: string;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  gstinOrTaxId?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  outstandingBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseStatus = 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseItem {
  _id?: string;
  productId: string;
  sku?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface Purchase {
  _id: string;
  organizationId: string;
  purchaseNumber: string;
  supplierId: string;
  date: string;
  items: PurchaseItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  status: PurchaseStatus;
  notes?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
