import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api/client';
import { TrendingUp, Users, Repeat, ShieldAlert } from 'lucide-react';

interface SaaSDashboardProps {
  onNavigate: (path: string) => void;
}

export const SaaSDashboard: React.FC<SaaSDashboardProps> = ({ onNavigate }) => {
  const { organization, user } = useAuth();
  const [data, setData] = useState<any>(null);
  
  useEffect(() => {
    apiRequest('/reports/saas').then(res => {
      if(res.success) setData(res.data);
    }).catch(console.error);
  }, []);

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
          <div className="kpi-value">{organization?.settings?.currencySymbol || '$'}{(data?.mrr || 0).toLocaleString()}</div>
          <p className="kpi-desc">Total active monthly subscription value</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Active Subscriptions</span>
            <Repeat size={18} color="var(--color-success)" />
          </div>
          <div className="kpi-value">{data?.activeSubscriptions || 0}</div>
          <p className="kpi-desc">Currently active paying accounts</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Churn Rate</span>
            <ShieldAlert size={18} color="var(--color-danger)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>{data?.churnRatePercent || 0}%</div>
          <p className="kpi-desc">Subscribers lost overall</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Trial Users</span>
            <Users size={18} color="var(--accent-primary)" />
          </div>
          <div className="kpi-value">{data?.trialSubscriptions || 0}</div>
          <p className="kpi-desc">Signups currently evaluating</p>
        </div>
      </div>
    </div>
  );
};
