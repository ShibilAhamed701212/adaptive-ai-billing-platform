import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTaxSystem } from '../../utils/tax';
import { OrganizationSwitcher } from './OrganizationSwitcher';
import { Sparkles, LogOut, Menu } from 'lucide-react';

interface NavbarProps {
  onOpenAiDrawer: () => void;
  onNavigate: (path: string) => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAiDrawer, onNavigate, onToggleSidebar, isSidebarOpen }) => {
  const { user, organization, logout } = useAuth();
  const { systemLabel } = useTaxSystem();

  return (
    <header
      className="app-navbar"
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
        <button
          className="btn btn-ghost btn-sm app-menu-toggle"
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isSidebarOpen}
        >
          <Menu size={20} />
        </button>
        <OrganizationSwitcher onNavigate={onNavigate} />

        {organization?.businessType && (
          <span
            className="app-hide-sm"
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
        <button
          className="btn btn-primary"
          onClick={onOpenAiDrawer}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.1rem' }}
          title="Open AI Copilot"
          aria-label="Open AI Copilot"
        >
          <Sparkles size={16} />
          <span className="app-hide-sm">Ask AI Copilot</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '1.25rem' }}>
          <div className="app-hide-sm" style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name}</div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {user?.role} • {systemLabel}
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            style={{ color: 'var(--color-danger)' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
