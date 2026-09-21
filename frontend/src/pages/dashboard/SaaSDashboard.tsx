import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { TrendingUp, Users, Repeat, ShieldAlert } from 'lucide-react';

interface SaaSDashboardProps {
  onNavigate: (path: string) => void;
}

export const SaaSDashboard: React.FC<SaaSDashboardProps> = ({ onNavigate }) => {
  const { organization, user } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{organization?.name || 'SaaS Dashboard'}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Welcome back, {user?.name}. Here is your subscription MRR and churn overview.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">MRR (Monthly Recurring Revenue)</span>
            <TrendingUp size={18} color="var(--accent-primary)" />
          </div>
          <div className="kpi-value">$1,250</div>
          <p className="kpi-desc">Total active monthly subscription value</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Active Subscriptions</span>
            <Repeat size={18} color="var(--color-success)" />
          </div>
          <div className="kpi-value">10</div>
          <p className="kpi-desc">Currently active paying accounts</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Churn Rate</span>
            <ShieldAlert size={18} color="var(--color-danger)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>4.5%</div>
          <p className="kpi-desc">Subscribers lost this month</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">New Trial Users</span>
            <Users size={18} color="var(--accent-primary)" />
          </div>
          <div className="kpi-value">2</div>
          <p className="kpi-desc">Signups currently evaluating</p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Recent Subscriptions</h3>
        <p className="section-lead">Latest subscription activity</p>
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Plan</th>
                <th>MRR</th>
                <th>Status</th>
                <th>Renewal Date</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Tech Corp 1</td>
                <td>Enterprise</td>
                <td>$990 (Annual)</td>
                <td><span className="badge badge-paid">Active</span></td>
                <td>Next Year</td>
              </tr>
              <tr>
                <td>Tech Corp 2</td>
                <td>Starter</td>
                <td>$29 / mo</td>
                <td><span className="badge badge-draft">Trialing</span></td>
                <td>Next Week</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
