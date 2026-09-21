import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Briefcase, Clock4, Banknote, ShieldCheck } from 'lucide-react';

interface AgencyDashboardProps {
  onNavigate: (path: string) => void;
}

export const AgencyDashboard: React.FC<AgencyDashboardProps> = ({ onNavigate }) => {
  const { organization, user } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{organization?.name || 'Agency Dashboard'}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Welcome back, {user?.name}. Here is your project and billable hours overview.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Active Projects</span>
            <Briefcase size={18} color="var(--accent-primary)" />
          </div>
          <div className="kpi-value">8</div>
          <p className="kpi-desc">Ongoing client engagements</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Unbilled Hours</span>
            <Clock4 size={18} color="var(--color-warning)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>42.5 hrs</div>
          <p className="kpi-desc">Timesheets pending invoicing</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Outstanding Invoices</span>
            <Banknote size={18} color="var(--color-danger)" />
          </div>
          <div className="kpi-value">€12,500</div>
          <p className="kpi-desc">Awaiting client payment</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Active Retainers</span>
            <ShieldCheck size={18} color="var(--color-success)" />
          </div>
          <div className="kpi-value">2</div>
          <p className="kpi-desc">Clients on monthly retainer</p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Active Projects Status</h3>
        <p className="section-lead">Current utilization vs budget</p>
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Client</th>
                <th>Hourly Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Website Redesign 1</td>
                <td>Client Brand 1</td>
                <td>€150 / hr</td>
                <td><span className="badge badge-paid">Active</span></td>
              </tr>
              <tr>
                <td>Website Redesign 2</td>
                <td>Client Brand 2</td>
                <td>€150 / hr</td>
                <td><span className="badge badge-paid">Active</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
