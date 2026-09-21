import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { TrendingUp, CreditCard, AlertTriangle, Users } from 'lucide-react';

interface GeneralDashboardProps {
  onNavigate: (path: string) => void;
}

export const GeneralDashboard: React.FC<GeneralDashboardProps> = ({ onNavigate }) => {
  const { organization, user } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{organization?.name || 'Dashboard'}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Welcome back, {user?.name}. Here is your financial overview.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Invoiced</span>
            <TrendingUp size={18} color="var(--accent-primary)" />
          </div>
          <div className="kpi-value">$24,000</div>
          <p className="kpi-desc">Total cumulative gross billed</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Outstanding Receivables</span>
            <CreditCard size={18} color="var(--color-warning)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>$4,500</div>
          <p className="kpi-desc">Pending settlement</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Overdue Balance</span>
            <AlertTriangle size={18} color="var(--color-danger)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>$0</div>
          <p className="kpi-desc">Invoices past due date</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Active Clients</span>
            <Users size={18} color="var(--accent-primary)" />
          </div>
          <div className="kpi-value">10</div>
          <p className="kpi-desc">Customers with recent activity</p>
        </div>
      </div>
    </div>
  );
};
