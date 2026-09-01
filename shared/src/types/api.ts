export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DashboardSummary {
  kpis: {
    totalRevenue: number;
    revenueGrowthMoM: number;
    totalOutstanding: number;
    overdueAmount: number;
    paidInvoicesCount: number;
    pendingInvoicesCount: number;
    activeCustomersCount: number;
  };
  cashflowProjection: {
    dates: string[];
    projectedInflow: number[];
    projectedOutflow: number[];
  };
  recentInvoices: any[];
  anomalies: any[];
  aiDailyBrief: {
    greeting: string;
    summaryBullets: string[];
    priorityActions: {
      action: string;
      urgency: 'high' | 'medium' | 'low';
      linkTo?: string;
    }[];
  };
}
