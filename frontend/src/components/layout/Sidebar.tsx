import React from 'react';
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  Wand2,
  Sliders,
  CreditCard,
  Building2,
  Repeat,
  FileMinus,
  ShieldCheck,
  TrendingUp,
  ShieldAlert,
  Truck,
  ShoppingCart,
  Undo2,
  Clock4,
  Banknote,
  Archive,
  DatabaseBackup,
  PauseCircle
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const { organization } = useAuth();
  const enabledModules = organization?.enabledModules || [];

  const allMenuItems = [
    { label: 'Executive Dashboard', desc: 'KPIs, AI daily brief & forecast', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Point of Sale (POS)', desc: 'Retail checkout & barcode scanner', path: '/pos', icon: Package, module: 'pos' },
    { label: 'Held Bills', desc: 'Parked & suspended transactions', path: '/held-bills', icon: PauseCircle, module: 'pos' },
    { label: 'Inventory & Stock', desc: 'Movements, adjustments & valuation', path: '/inventory', icon: Archive, module: 'inventory' },
    { label: 'Purchases', desc: 'Inbound stock & receiving', path: '/purchases', icon: ShoppingCart, module: 'purchases' },
    { label: 'Suppliers', desc: 'Vendors & payables', path: '/suppliers', icon: Truck, module: 'suppliers' },
    { label: 'Returns & Refunds', desc: 'Restock & exchange workflow', path: '/returns', icon: Undo2, module: 'returns' },
    { label: 'Shifts & Cash Drawer', desc: 'Opening cash & discrepancies', path: '/shifts', icon: Clock4, module: 'shifts' },
    { label: 'Expenses', desc: 'Shift expenses & operational costs', path: '/expenses', icon: Banknote, module: 'expenses' },
    { label: 'Invoicing Studio', desc: 'Create, issue & print tax invoices', path: '/invoices', icon: FileText, module: 'invoices' },
    { label: 'Payments & AR', desc: 'Reconciliations, refunds & ledger', path: '/payments', icon: CreditCard, module: 'payments' },
    { label: 'Recurring Subscriptions', desc: 'Automate periodic billing schedules', path: '/recurring', icon: Repeat, module: 'subscriptions' },
    { label: 'Credit Notes & Rebates', desc: 'Issue credit notes against invoices', path: '/credit-notes', icon: FileMinus, module: 'credit_notes' },
    { label: 'Approval Queue', desc: 'Manager review for large invoices', path: '/approvals', icon: ShieldCheck, module: 'approvals' },
    { label: 'Financial Reports', desc: 'Revenue, AR aging & statements', path: '/reports', icon: TrendingUp, module: 'reports' },
    { label: 'Customers', desc: 'Client profiles, GSTIN & balances', path: '/customers', icon: Users, module: 'customers' },
    { label: 'Products & Services', desc: 'SKUs, pricing tiers & tax rates', path: '/products', icon: Package, module: 'products' },
    { label: 'System Backup', desc: 'Export & restore data', path: '/backup', icon: DatabaseBackup },
    { label: 'Dynamic Rules & Studio', desc: 'Custom templates, fields & rules', path: '/settings', icon: Sliders },
    { label: 'AI Model Onboarding', desc: 'Business discovery & matcher', path: '/onboarding', icon: Wand2 },
    { label: 'Compliance & Audit', desc: 'Immutable audit logs & tracking', path: '/audit', icon: ShieldAlert },
  ];

  const menuItems = allMenuItems;

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
      }}
    >
      {/* Brand Title */}
      <div style={{ padding: '0 0.5rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #f1f5f9', marginBottom: '1rem' }}>
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
            boxShadow: '0 2px 6px rgba(79, 70, 229, 0.3)',
          }}
        >
          A
        </div>
        <div>
          <h2 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>AdaptiveBilling</h2>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Multi-Tenant Invoicing Platform
          </span>
        </div>
      </div>

      {/* Nav Menu */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path || (item.path !== '/dashboard' && currentPath.startsWith(item.path));

          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.65rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                background: isActive ? '#eef2ff' : 'transparent',
                border: isActive ? '1px solid #c7d2fe' : '1px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all var(--transition-fast)',
              }}
            >
              <Icon size={18} style={{ marginTop: '0.15rem', flexShrink: 0 }} color={isActive ? 'var(--accent-primary)' : '#64748b'} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: isActive ? 600 : 500, lineHeight: 1.25 }}>{item.label}</span>
                <span style={{ fontSize: '0.7rem', color: isActive ? '#6366f1' : '#94a3b8', marginTop: '0.1rem' }}>{item.desc}</span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div
        style={{
          padding: '0.85rem',
          background: '#f8fafc',
          borderRadius: 'var(--radius-md)',
          border: '1px solid #e2e8f0',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          <Building2 size={13} color="var(--accent-primary)" /> Tenant Data Isolation
        </div>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.7rem' }}>All collections scoped by organizationId</p>
      </div>
    </aside>
  );
};
