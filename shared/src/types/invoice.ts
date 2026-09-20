export type InvoiceStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'sent'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'void'
  | 'cancelled';

export interface InvoiceItem {
  _id?: string;
  productId?: string;
  sku?: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number; // Snapshot of unit price at invoice time
  discountAmount: number; // Snapshot of line discount
  discountPercentage?: number;
  taxRate: number; // e.g. 0.18
  taxAmount: number; // Computed tax for this line
  hsnSacCode?: string;
  lineTotal: number; // (quantity * unitPrice - discount) + taxAmount
  customFields?: Record<string, any>;
}

export interface TaxBreakdown {
  taxType: 'CGST' | 'SGST' | 'IGST' | 'VAT' | 'SALES_TAX' | 'CUSTOM';
  rate: number;
  taxableAmount: number;
  taxAmount: number;
}

export interface InvoiceTotals {
  rawSubtotal: number;
  itemDiscountTotal: number;
  invoiceDiscountTotal: number;
  totalDiscount: number;
  taxableAmount: number;
  taxBreakdown: TaxBreakdown[];
  taxTotal: number;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
}

export interface Invoice {
  _id: string;
  organizationId: string;
  invoiceNumber: string;
  customerId: string;
  customerSnapshot: {
    name: string;
    email: string;
    phone?: string;
    companyName?: string;
    gstinOrTaxId?: string;
    billingAddress: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  };
  issueDate: string;
  dueDate: string;
  currency: string;
  currencySymbol: string;
  items: InvoiceItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  taxBreakdown: TaxBreakdown[];
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  amountTendered?: number;
  changeGiven?: number;
  shiftId?: string;
  status: InvoiceStatus;
  notes?: string;
  terms?: string;
  customFields: Record<string, any>;
  paymentHistory?: {
    paymentId: string;
    amount: number;
    paymentDate: string;
    method: string;
    reference?: string;
  }[];
  pdfUrl?: string;
  aiRiskScore?: 'LOW' | 'MEDIUM' | 'HIGH';
  aiRiskExplanation?: string;
  predictedPaymentDate?: string;
  createdBy: string;
  clientTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}
