import React from 'react';
import {
  LayoutDashboard, FileText, Users, Package, CreditCard, Building2, Repeat, FileMinus,
  ShieldCheck, TrendingUp, ShieldAlert, Truck, ShoppingCart, Undo2, Clock4, Banknote,
  Archive, DatabaseBackup, PauseCircle, Sliders, Briefcase, Activity, CheckSquare, Layers
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '@billing/shared';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

interface MenuItem {
  label: string;
  desc: string;
  path: string;
  icon: any;
  module?: string;
  roles?: UserRole[];
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const { organization, user } = useAuth();
  const enabledModules = organization?.enabledModules || [];
  const role = (user?.role || 'viewer') as UserRole;
  const businessType = organization?.businessType || 'general';

  // Base Administration that is common to all
  const adminGroup: MenuGroup = {
    title: 'Administration',
    items: [
      { label: 'Team', desc: 'Members & roles', path: '/team', icon: ShieldCheck, roles: ['admin', 'manager'] },
      { label: 'Organization Settings', desc: 'Profile, tax & rules', path: '/settings', icon: Sliders, roles: ['admin', 'manager'] },
      { label: 'Backup & Restore', desc: 'Export & restore data', path: '/backup', icon: DatabaseBackup, roles: ['admin'] },
      { label: 'Compliance & Audit', desc: 'Immutable audit logs', path: '/audit', icon: ShieldAlert, roles: ['admin'] },
      { label: 'System Tests', desc: 'Developer Sandbox', path: '/dev/billing-test', icon: Activity, roles: ['admin'] },
    ],
  };

  const analyticsGroup: MenuGroup = {
    title: 'Analytics',
    items: [
      { label: 'Reports', desc: 'Revenue, AR aging & Tax', path: '/reports', icon: TrendingUp, module: 'reports' },
    ],
  };

  let groups: MenuGroup[] = [];

  if (businessType === 'retail') {
    groups = [
      {
        title: 'Store Front',
        items: [
          { label: 'Dashboard', desc: 'Store overview', path: '/dashboard', icon: LayoutDashboard },
          { label: 'Point of Sale', desc: 'Checkout & barcode', path: '/pos', icon: Package, module: 'pos' },
          { label: 'Held Bills', desc: 'Parked carts', path: '/held-bills', icon: PauseCircle, module: 'pos' },
        ],
      },
      {
        title: 'Catalog & Inventory',
        items: [
          { label: 'Products', desc: 'SKUs & pricing', path: '/products', icon: Package, module: 'products' },
          { label: 'Inventory', desc: 'Stock movements', path: '/inventory', icon: Archive, module: 'inventory' },
          { label: 'Purchases', desc: 'Inbound stock', path: '/purchases', icon: ShoppingCart, module: 'purchases' },
          { label: 'Suppliers', desc: 'Vendors & payables', path: '/suppliers', icon: Truck, module: 'suppliers' },
        ],
      },
      {
        title: 'Accounts',
        items: [
          { label: 'Invoices', desc: 'B2B billing', path: '/invoices', icon: FileText, module: 'invoices' },
          { label: 'Payments', desc: 'Reconciliations', path: '/payments', icon: CreditCard, module: 'payments' },
          { label: 'Customers', desc: 'Loyalty & profiles', path: '/customers', icon: Users, module: 'customers' },
        ],
      },
      {
        title: 'Operations',
        items: [
          { label: 'Shifts', desc: 'Cash drawer tracking', path: '/shifts', icon: Clock4, module: 'shifts' },
          { label: 'Expenses', desc: 'Store operational costs', path: '/expenses', icon: Banknote, module: 'expenses' },
        ],
      },
      analyticsGroup,
      adminGroup,
    ];
  } else if (businessType === 'saas') {
    groups = [
      {
        title: 'Platform',
        items: [
          { label: 'Dashboard', desc: 'MRR & Churn', path: '/dashboard', icon: LayoutDashboard },
          { label: 'Plans', desc: 'Pricing tiers', path: '/plans', icon: Layers, module: 'plans' },
          { label: 'Subscriptions', desc: 'Active subscribers', path: '/subscriptions', icon: Repeat, module: 'subscriptions' },
          { label: 'Customers', desc: 'Tenant accounts', path: '/customers', icon: Users, module: 'customers' },
        ],
      },
      {
        title: 'Billing & Usage',
        items: [
          { label: 'Invoices', desc: 'Recurring billing', path: '/invoices', icon: FileText, module: 'invoices' },
          { label: 'Payments', desc: 'Card processing', path: '/payments', icon: CreditCard, module: 'payments' },
          { label: 'Usage Logs', desc: 'Metered billing', path: '/usage', icon: Activity, module: 'usage' },
        ],
      },
      analyticsGroup,
      adminGroup,
    ];
  } else if (businessType === 'services') {
    groups = [
      {
        title: 'Agency',
        items: [
          { label: 'Dashboard', desc: 'Project overview', path: '/dashboard', icon: LayoutDashboard },
          { label: 'Clients', desc: 'Accounts & contacts', path: '/clients', icon: Users, module: 'customers' },
          { label: 'Projects', desc: 'Active engagements', path: '/projects', icon: Briefcase, module: 'projects' },
          { label: 'Services', desc: 'Rate cards', path: '/services', icon: Layers, module: 'services' },
        ],
      },
      {
        title: 'Work & Billing',
        items: [
          { label: 'Timesheets', desc: 'Billable hours', path: '/timesheets', icon: Clock4, module: 'timesheets' },
          { label: 'Retainers', desc: 'Prepaid balances', path: '/retainers', icon: ShieldCheck, module: 'retainers' },
          { label: 'Invoices', desc: 'Issue billing', path: '/invoices', icon: FileText, module: 'invoices' },
          { label: 'Payments', desc: 'Receivables', path: '/payments', icon: CreditCard, module: 'payments' },
          { label: 'Expenses', desc: 'Reimbursables', path: '/expenses', icon: Banknote, module: 'expenses' },
        ],
      },
      analyticsGroup,
      adminGroup,
    ];
  } else {
    // General Business
    groups = [
      {
        title: 'Home',
        items: [
          { label: 'Dashboard', desc: 'Business overview', path: '/dashboard', icon: LayoutDashboard },
        ],
      },
      {
        title: 'Sales',
        items: [
          { label: 'Invoices', desc: 'Create & issue', path: '/invoices', icon: FileText, module: 'invoices' },
          { label: 'Payments', desc: 'Reconciliations', path: '/payments', icon: CreditCard, module: 'payments' },
          { label: 'Customers', desc: 'Client profiles', path: '/customers', icon: Users, module: 'customers' },
        ],
      },
      {
        title: 'Catalog',
        items: [
          { label: 'Products & Services', desc: 'Offerings & pricing', path: '/products', icon: Package, module: 'products' },
        ],
      },
      {
        title: 'Operations',
        items: [
          { label: 'Expenses', desc: 'Operational costs', path: '/expenses', icon: Banknote, module: 'expenses' },
        ],
      },
      analyticsGroup,
      adminGroup,
    ];
  }

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.module && !enabledModules.includes(item.module)) return false;
        if (item.roles && !item.roles.includes(role)) return false;
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      style={{
        width: '17.5rem',
        minHeight: '100vh',
        background: '#ffffff',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem 1rem',
        overflowY: 'auto',
        maxHeight: '100vh',
      }}
    >
      <div style={{ padding: '0 0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #f1f5f9', marginBottom: '1rem' }}>
        <div
          style={{
            width: '2.25rem',
            height: '2.25rem',
            borderRadius: '10px',
            background: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '1.15rem',
          }}
        >
          {organization?.name ? organization.name.charAt(0).toUpperCase() : 'A'}
        </div>
        <div>
          <h2 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)' }}>AdaptiveBilling</h2>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {organization?.name || 'Billing Platform'}
          </span>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
        {visibleGroups.map((group) => (
          <div key={group.title}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 0.75rem 0.35rem' }}>
              {group.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath === item.path || (item.path !== '/dashboard' && currentPath.startsWith(item.path));
                return (
                  <button
                    key={item.path}
                    onClick={() => onNavigate(item.path)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.7rem',
                      padding: '0.55rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                      background: isActive ? '#eef2ff' : 'transparent',
                      border: isActive ? '1px solid #c7d2fe' : '1px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <Icon size={17} style={{ marginTop: '0.15rem', flexShrink: 0 }} color={isActive ? 'var(--accent-primary)' : '#64748b'} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.83rem', fontWeight: isActive ? 600 : 500, lineHeight: 1.2 }}>{item.label}</span>
                      <span style={{ fontSize: '0.68rem', color: isActive ? '#6366f1' : '#94a3b8', marginTop: '0.1rem' }}>{item.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div
        style={{
          padding: '0.85rem',
          background: '#f8fafc',
          borderRadius: 'var(--radius-md)',
          border: '1px solid #e2e8f0',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.4,
          marginTop: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          <Building2 size={13} color="var(--accent-primary)" /> Tenant data isolation
        </div>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.7rem' }}>All data scoped by organization</p>
      </div>
    </aside>
  );
};
