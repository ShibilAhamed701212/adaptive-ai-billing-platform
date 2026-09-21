import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api/client';
import { Briefcase, Clock4, Banknote, ShieldCheck } from 'lucide-react';

interface AgencyDashboardProps {
  onNavigate: (path: string) => void;
}

export const AgencyDashboard: React.FC<AgencyDashboardProps> = ({ onNavigate }) => {
  const { organization, user } = useAuth();
  const [data, setData] = useState<any>(null);
  
  useEffect(() => {
    apiRequest('/reports/agency').then(res => {
      if(res.success) setData(res.data);
    }).catch(console.error);
  }, []);

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
          <div className="kpi-value">{data?.activeProjects || 0}</div>
          <p className="kpi-desc">Ongoing client engagements</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Unbilled Hours</span>
            <Clock4 size={18} color="var(--color-warning)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>{data?.unbilledHours || 0} hrs</div>
          <p className="kpi-desc">Timesheets pending invoicing</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Outstanding Invoices</span>
            <Banknote size={18} color="var(--color-danger)" />
          </div>
          <div className="kpi-value">{organization?.settings?.currencySymbol || '€'}{(data?.outstandingInvoices || 0).toLocaleString()}</div>
          <p className="kpi-desc">Awaiting client payment</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Active Retainers</span>
            <ShieldCheck size={18} color="var(--color-success)" />
          </div>
          <div className="kpi-value">{data?.activeRetainers || 0}</div>
          <p className="kpi-desc">Clients on active retainer</p>
        </div>
      </div>
    </div>
  );
};
