import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api/client';
import { Package, TrendingUp, Users, ShoppingCart, Activity } from 'lucide-react';

interface RetailDashboardProps {
  onNavigate: (path: string) => void;
}

export const RetailDashboard: React.FC<RetailDashboardProps> = ({ onNavigate }) => {
  const { organization, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  
  useEffect(() => {
    apiRequest('/reports/dashboard-summary').then(res => {
      if(res.success) setData(res.data);
    }).catch(console.error);

    apiRequest('/reports/product-analytics?limit=5').then(res => {
      if(res.success && Array.isArray(res.data)) setTopProducts(res.data);
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
          <div className="kpi-value">{organization?.settings?.currencySymbol || 'â‚¹'}{(data?.grossSales || 0).toLocaleString()}</div>
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
          <div className="kpi-value">{organization?.settings?.currencySymbol || 'â‚¹'}{(data?.netProfit || 0).toLocaleString()}</div>
          <p className="kpi-desc">Gross margin {data?.grossMarginPercent || 0}%</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Refunds</span>
            <Users size={18} color="var(--color-danger)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>{organization?.settings?.currencySymbol || 'â‚¹'}{(data?.totalRefunds || 0).toLocaleString()}</div>
          <p className="kpi-desc">Value of returned items</p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
            <Activity size={18} color="var(--accent-primary)" /> Product Analytics & Top Sellers
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('/reports')}>Full Report</button>
        </div>
        
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>SKU</th>
                <th style={{ textAlign: 'right' }}>Units Sold</th>
                <th style={{ textAlign: 'right' }}>Total Revenue Generated</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No product sales data available yet.
                  </td>
                </tr>
              ) : (
                topProducts.map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{p.sku || '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.unitsSold}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success)' }}>
                      {organization?.settings?.currencySymbol || 'â‚¹'}{p.totalRevenue.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

