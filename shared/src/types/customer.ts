export interface Address {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface Customer {
  _id: string;
  organizationId: string;
  name: string;
  email: string;
  phone?: string;
  companyName?: string;
  gstinOrTaxId?: string;
  billingAddress: Address;
  shippingAddress?: Address;
  creditLimit?: number;
  outstandingBalance: number;
  currency: string;
  tags: string[];
  customFields: Record<string, any>;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
