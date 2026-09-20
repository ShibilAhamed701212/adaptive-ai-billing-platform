import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import {
  BusinessType,
  BUSINESS_TYPE_LABELS,
  modulesForBusinessType,
  ALL_MODULES,
} from '@billing/shared';
import { Building2, ArrowLeft, ArrowRight, Check } from 'lucide-react';

interface NewOrganizationPageProps {
  onNavigate: (path: string) => void;
}

const MODULE_LABELS: Record<string, string> = {
  invoices: 'Invoicing',
  customers: 'Customers',
  products: 'Products & Services',
  payments: 'Payments',
  reports: 'Reports',
  ai_copilot: 'AI Copilot',
  subscriptions: 'Recurring Billing',
  pos: 'Point of Sale',
  inventory: 'Inventory',
  purchases: 'Purchases',
  suppliers: 'Suppliers',
  returns: 'Returns & Refunds',
  shifts: 'Shifts & Cash Drawer',
  expenses: 'Expenses',
  credit_notes: 'Credit Notes',
  approvals: 'Approvals',
};

export const NewOrganizationPage: React.FC<NewOrganizationPageProps> = ({ onNavigate }) => {
  const { createOrganization } = useAuth();
  const { show } = useToast();

  const [name, setName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('retail');
  const [modules, setModules] = useState<string[]>(modulesForBusinessType('retail'));
  const [country, setCountry] = useState('India');
  const [currency, setCurrency] = useState('INR');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableModules = useMemo(() => Array.from(new Set(ALL_MODULES)), []);

  const handleBusinessType = (bt: BusinessType) => {
    setBusinessType(bt);
    setModules(modulesForBusinessType(bt));
  };

  const toggleModule = (mod: string) => {
    setModules((prev) => (prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const res = await createOrganization({
      name: name.trim(),
      businessType,
      enabledModules: modules,
      settings: { currency, country },
    });

    setSaving(false);
    if (res.success) {
      show(`Organization "${name.trim()}" created`, 'success');
      onNavigate('/onboarding');
    } else {
      setError(res.error || 'Failed to create organization');
      show(res.error || 'Failed to create organization', 'error');
    }
  };

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('/dashboard')} style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={15} /> Back to dashboard
      </button>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '12px', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Building2 size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Create a new organization</h1>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              You will become the admin of this organization and can switch back at any time.
            </p>
          </div>
        </div>

        {error && (
          <div style={{ background: 'var(--color-danger-bg)', border: '1px solid rgba(244,63,94,0.3)', color: 'var(--color-danger)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', margin: '1rem 0' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">Organization / business name *</label>
            <input className="form-input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shibil Supermarket" />
          </div>

          <div className="form-group">
            <label className="form-label">What type of business is this?</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(Object.keys(BUSINESS_TYPE_LABELS) as BusinessType[]).map((bt) => (
                <button
                  type="button"
                  key={bt}
                  onClick={() => handleBusinessType(bt)}
                  className={`btn ${businessType === bt ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                >
                  {businessType === bt && <Check size={13} />} {BUSINESS_TYPE_LABELS[bt]}
                </button>
              ))}
            </div>
            <span className="element-desc">This selects a sensible default set of modules below — you can customize them.</span>
          </div>

          <div className="form-group">
            <label className="form-label">Enabled modules</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
              {availableModules.map((mod) => (
                <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', padding: '0.45rem 0.6rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={modules.includes(mod)} onChange={() => toggleModule(mod)} />
                  {MODULE_LABELS[mod] || mod}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input className="form-input" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Currency</label>
              <input className="form-input" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="INR / USD / EUR" />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => onNavigate('/dashboard')}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
              {saving ? 'Creating...' : 'Create organization'} <ArrowRight size={15} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
