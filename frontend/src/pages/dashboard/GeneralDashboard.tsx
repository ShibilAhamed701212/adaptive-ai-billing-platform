import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api/client';
import { TrendingUp, CreditCard, AlertTriangle, Users, Activity } from 'lucide-react';

interface GeneralDashboardProps {
  onNavigate: (path: string) => void;
}

interface Kpis {
  totalRevenue: number;
  totalOutstanding: number;
  overdueAmount: number;
  activeCustomersCount: number;
}

export const GeneralDashboard: React.FC<GeneralDashboardProps> = ({ onNavigate }) => {
  const { organization, user } = useAuth();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest('/reports/dashboard-summary')
      .then((res: any) => {
        if (cancelled) return;
        if (res.success && res.data?.kpis) {
          setKpis(res.data.kpis);
        } else {
          setError('Unable to load financial overview');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load financial overview');
      });

    apiRequest('/reports/product-analytics?limit=5')
      .then((res: any) => {
        if (cancelled) return;
        if (res.success && Array.isArray(res.data)) {
          setTopProducts(res.data);
        }
      })
      .catch(console.error);
      
    return () => {
      cancelled = true;
    };
  }, []);

  const symbol = organization?.settings?.currencySymbol || 'â‚¹';
  const fmt = (n: number | undefined) => symbol + (n || 0).toLocaleString();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{organization?.name || 'Dashboard'}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Welcome back, {user?.name}. Here is your financial overview.
        </p>
      </div>

      {error && (
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
          <p style={{ margin: 0, color: 'var(--color-danger)' }}>{error}</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Invoiced</span>
            <TrendingUp size={18} color="var(--accent-primary)" />
          </div>
          <div className="kpi-value">{fmt(kpis?.totalRevenue)}</div>
          <p className="kpi-desc">Total cumulative gross billed</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Outstanding Receivables</span>
            <CreditCard size={18} color="var(--color-warning)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>{fmt(kpis?.totalOutstanding)}</div>
          <p className="kpi-desc">Pending settlement</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Overdue Balance</span>
            <AlertTriangle size={18} color="var(--color-danger)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>{fmt(kpis?.overdueAmount)}</div>
          <p className="kpi-desc">Invoices past due date</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Active Clients</span>
            <Users size={18} color="var(--accent-primary)" />
          </div>
          <div className="kpi-value">{kpis?.activeCustomersCount ?? 0}</div>
          <p className="kpi-desc">Customers with recent activity</p>
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
                      {symbol}{p.totalRevenue.toLocaleString()}
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
