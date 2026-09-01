export interface InvoiceCopilotParseRequest {
  prompt: string;
}

export interface InvoiceCopilotDraft {
  customerName?: string;
  customerId?: string;
  items: {
    productName: string;
    productId?: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
    unit?: string;
  }[];
  dueDateOffsetDays?: number;
  notes?: string;
  confidenceScore: number;
  explanation: string;
}

export interface AnomalyAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'duplicate_invoice' | 'unusual_discount' | 'late_risk' | 'price_deviation';
  title: string;
  description: string;
  suggestedAction: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  timestamp: string;
}

export interface AskBusinessQueryRequest {
  query: string;
}

export interface AskBusinessQueryResponse {
  answer: string;
  chartData?: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
    }[];
  };
  sourcesUsed: string[];
  suggestedFollowUps: string[];
}
