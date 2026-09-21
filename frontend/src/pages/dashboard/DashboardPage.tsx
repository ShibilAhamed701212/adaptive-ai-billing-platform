import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { RetailDashboard } from './RetailDashboard';
import { SaaSDashboard } from './SaaSDashboard';
import { AgencyDashboard } from './AgencyDashboard';
import { GeneralDashboard } from './GeneralDashboard';
import { Sparkles } from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { organization } = useAuth();
  
  if (!organization) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-secondary)' }}>
        <Sparkles size={32} className="animate-spin" color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
        <p style={{ fontWeight: 600 }}>Loading AI Financial Intelligence...</p>
      </div>
    );
  }

  const businessType = organization.businessType || 'general';

  switch (businessType) {
    case 'retail':
      return <RetailDashboard onNavigate={onNavigate} />;
    case 'saas':
      return <SaaSDashboard onNavigate={onNavigate} />;
    case 'services':
      return <AgencyDashboard onNavigate={onNavigate} />;
    case 'general':
    default:
      return <GeneralDashboard onNavigate={onNavigate} />;
  }
};
