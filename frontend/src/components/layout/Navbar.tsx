import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { OrganizationSwitcher } from './OrganizationSwitcher';
import { Sparkles, LogOut } from 'lucide-react';

interface NavbarProps {
  onOpenAiDrawer: () => void;
  onNavigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAiDrawer, onNavigate }) => {
  const { user, organization, logout } = useAuth();

  return (
    <header
      style={{
        height: '4.25rem',
        borderBottom: '1px solid var(--border-subtle)',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2rem',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
      }}
    >
      {/* Left: Organization context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <OrganizationSwitcher onNavigate={onNavigate} />

        {organization?.businessType && (
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              background: '#e0e7ff',
              color: '#3730a3',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              border: '1px solid #c7d2fe',
              textTransform: 'capitalize',
            }}
          >
            {organization.businessType}
          </span>
        )}
      </div>

      {/* Right: AI Copilot + User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <button
          className="btn btn-primary"
          onClick={onOpenAiDrawer}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.1rem' }}
          title="Open AI Copilot"
        >
          <Sparkles size={16} />
          <span>Ask AI Copilot</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '1.25rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name}</div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {user?.role} • {organization?.settings?.taxSystem || 'GST'} Tax
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={logout}
            title="Sign out"
            style={{ color: 'var(--color-danger)' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
