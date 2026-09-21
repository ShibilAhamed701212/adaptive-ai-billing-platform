import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api/client';
import { Package, TrendingUp, Users, ShoppingCart } from 'lucide-react';

interface RetailDashboardProps {
  onNavigate: (path: string) => void;
}

export const RetailDashboard: React.FC<RetailDashboardProps> = ({ onNavigate }) => {
  const { organization, user } = useAuth();
  const [data, setData] = useState<any>(null);
  
  useEffect(() => {
    apiRequest('/reports/dashboard-summary').then(res => {
      if(res.success) setData(res.data);
    }).catch(console.error);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{organization?.name || 'Retail Dashboard'}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Welcome back, {user?.name}. Here is your live point-of-sale and inventory overview.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Gross Sales</span>
            <TrendingUp size={18} color="var(--accent-primary)" />
          </div>
          <div className="kpi-value">{organization?.settings?.currencySymbol || '₹'}{(data?.grossSales || 0).toLocaleString()}</div>
          <p className="kpi-desc">Total volume</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Transactions</span>
            <ShoppingCart size={18} color="var(--color-success)" />
          </div>
          <div className="kpi-value">{data?.transactionCount || 0}</div>
          <p className="kpi-desc">Completed checkouts</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Net Profit</span>
            <Package size={18} color="var(--color-success)" />
          </div>
          <div className="kpi-value">{organization?.settings?.currencySymbol || '₹'}{(data?.netProfit || 0).toLocaleString()}</div>
          <p className="kpi-desc">Gross margin {data?.grossMarginPercent || 0}%</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Refunds</span>
            <Users size={18} color="var(--color-danger)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>{organization?.settings?.currencySymbol || '₹'}{(data?.totalRefunds || 0).toLocaleString()}</div>
          <p className="kpi-desc">Value of returned items</p>
        </div>
      </div>
    </div>
  );
};
