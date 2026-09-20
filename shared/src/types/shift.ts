export interface Shift {
  _id: string;
  organizationId: string;
  userId: string;
  status: 'OPEN' | 'CLOSED';
  startTime: string;
  endTime?: string;
  openingCash: number;
  expectedCash?: number;
  actualCash?: number;
  difference?: number;
  totals: {
    cashSales: number;
    cardSales: number;
    upiSales: number;
    creditSales: number;
    refunds: number;
    expenses: number;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  _id: string;
  organizationId: string;
  shiftId?: string;
  userId: string;
  category: string;
  amount: number;
  date: string;
  description: string;
  receiptUrl?: string;
  createdAt: string;
  updatedAt: string;
}
