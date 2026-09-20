import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { apiRequest } from '../../api/client';
import {
  ALL_MODULES,
  BUSINESS_TYPE_LABELS,
  BusinessType,
  modulesForBusinessType,
} from '@billing/shared';
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Building2,
  Receipt,
  MapPin,
  Layers,
  Rocket,
  RefreshCw,
  Wand2,
  AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface OnboardingPageProps {
  onNavigate: (path: string) => void;
}

const STEPS = [
  { id: 1, title: 'Welcome', icon: Sparkles },
  { id: 2, title: 'Business identity', icon: Building2 },
  { id: 3, title: 'Tax', icon: Receipt },
  { id: 4, title: 'Business details', icon: MapPin },
  { id: 5, title: 'Modules', icon: Layers },
  { id: 6, title: 'Initial setup', icon: Rocket },
];

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

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ onNavigate }) => {
  const { organization, updateOrganization } = useAuth();
  const { show } = useToast();

  const [step, setStep] = useState<number>(organization?.onboarding?.currentStep || 1);
  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState(organization?.name || '');
  const [businessType, setBusinessType] = useState<BusinessType>(organization?.businessType || 'general');
  const [country, setCountry] = useState(organization?.settings?.address?.country || 'India');
  const [currency, setCurrency] = useState(organization?.settings?.currency || 'INR');
  const [timezone, setTimezone] = useState(organization?.settings?.timezone || 'Asia/Kolkata');

  const [taxSystem, setTaxSystem] = useState<string>(organization?.settings?.taxSystem || 'GST');
  const [gstin, setGstin] = useState(organization?.settings?.gstinOrTaxId || '');

  const [street, setStreet] = useState(organization?.settings?.address?.street || '');
  const [city, setCity] = useState(organization?.settings?.address?.city || '');
  const [state, setState] = useState(organization?.settings?.address?.state || '');
  const [postalCode, setPostalCode] = useState(organization?.settings?.address?.postalCode || '');

  const [modules, setModules] = useState<string[]>(
    organization?.enabledModules?.length ? organization.enabledModules : modulesForBusinessType(businessType)
  );

  // Optional AI assistant
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDescription, setAiDescription] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<{ suggestedModel: string; reason: string } | null>(null);

  const goTo = async (next: number) => {
    setSaving(true);
    const res = await apiRequest('/organizations/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        name: businessName || undefined,
        businessType,
        onboarding: { currentStep: next, completedSteps: STEPS.filter((s) => s.id < next).map((s) => s.title.toLowerCase()) },
      }),
    });
    setSaving(false);
    if (res.success && res.data) updateOrganization(res.data);
    setStep(next);
  };

  const toggleModule = (mod: string) => {
    setModules((prev) => (prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]));
  };

  const saveBusinessProfile = async () => {
    const res = await apiRequest('/organizations/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        name: businessName || undefined,
        businessType,
        enabledModules: modules,
        settings: {
          currency,
          timezone,
          taxSystem,
          gstinOrTaxId: gstin,
          address: { street, city, state, postalCode, country },
        },
      }),
    });
    if (res.success && res.data) {
      updateOrganization(res.data);
      return true;
    }
    show(res.error?.message || 'Failed to save your organization', 'error');
    return false;
  };

  const handleFinish = async () => {
    setSaving(true);
    const saved = await saveBusinessProfile();
    const res = await apiRequest('/organizations/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        isOnboarded: true,
        onboarding: { currentStep: 6, skipped: false, completedSteps: STEPS.map((s) => s.title.toLowerCase()) },
      }),
    });
    setSaving(false);
    if (saved && res.success && res.data) {
      updateOrganization(res.data);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      show('Your organization is ready', 'success');
      setTimeout(() => onNavigate('/dashboard'), 900);
    } else {
      show(res.error?.message || 'Could not complete onboarding', 'error');
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    const res = await apiRequest('/organizations/settings', {
      method: 'PATCH',
      body: JSON.stringify({ isOnboarded: true, onboarding: { skipped: true } }),
    });
    setSaving(false);
    if (res.success && res.data) {
      updateOrganization(res.data);
      show('You can finish setup any time from the dashboard', 'info');
      onNavigate('/dashboard');
    } else {
      show(res.error?.message || 'Could not skip onboarding', 'error');
    }
  };

  const runAiAssistant = async () => {
    if (!aiDescription.trim()) return;
    setAiBusy(true);
    setAiError(null);
    const res = await apiRequest<{ suggestedModel: string; reason: string; preset?: any }>('/ai/onboarding/suggest-model', {
      method: 'POST',
      body: JSON.stringify({ businessDescription: aiDescription, industry: businessType }),
    });
    setAiBusy(false);
    if (res.success && res.data) {
      setAiSuggestions({ suggestedModel: res.data.suggestedModel, reason: res.data.reason });
      const preset = res.data.preset;
      if (preset?.defaultModules) setModules(Array.from(new Set(preset.defaultModules)));
      show('AI assistant updated your setup suggestions', 'success');
    } else {
      setAiError(res.error?.message?.includes('LLM_NOT_CONFIGURED')
        ? 'The AI assistant is not configured on this server. Continue manually — everything still works.'
        : res.error?.message || 'The AI assistant is currently unavailable. Continue manually.');
    }
  };

  const setupActions = [
    modules.includes('products') && { label: 'Add your first product', path: '/products' },
    modules.includes('customers') && { label: 'Add your first customer', path: '/customers' },
    modules.includes('pos') && { label: 'Configure POS & open a shift', path: '/shifts' },
    modules.includes('subscriptions') && { label: 'Create your first subscription', path: '/recurring' },
    modules.includes('invoices') && { label: 'Create your first invoice', path: '/invoices' },
    { label: 'Invite your team', path: '/team' },
  ].filter(Boolean) as { label: string; path: string }[];

  const current = STEPS.find((s) => s.id === step) || STEPS[0];

  return (
    <div style={{ maxWidth: '860px', margin: '1rem auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '20px', background: 'var(--accent-gradient)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
          <current.icon size={26} color="#fff" />
        </div>
        <h1 style={{ fontSize: '1.9rem', marginBottom: '0.3rem', fontWeight: 800 }}>Set up your organization</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Step {step} of {STEPS.length} — {current.title}
        </p>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '2rem' }}>
        {STEPS.map((s) => (
          <div key={s.id} style={{ flex: 1, height: '5px', borderRadius: '999px', background: s.id <= step ? 'var(--accent-primary)' : '#e2e8f0' }} />
        ))}
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: '1.3rem', marginTop: 0 }}>Welcome to Adaptive Billing</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Let's set up <strong>{organization?.name || 'your organization'}</strong>. We'll capture your business identity, tax settings,
              and choose the modules you need — then you're ready to bill.
            </p>
            <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              You can complete this now or skip it and finish later from the dashboard checklist.
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.3rem', marginTop: 0 }}>Business identity</h2>
            <div className="form-group">
              <label className="form-label">Business / organization name *</label>
              <input className="form-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Business type</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {(Object.keys(BUSINESS_TYPE_LABELS) as BusinessType[]).map((bt) => (
                  <button type="button" key={bt} className={`btn ${businessType === bt ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setBusinessType(bt)}>
                    {BUSINESS_TYPE_LABELS[bt]}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Country</label>
                <input className="form-input" value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <input className="form-input" value={currency} onChange={(e) => setCurrency(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Timezone</label>
                <input className="form-input" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.3rem', marginTop: 0 }}>Tax configuration</h2>
            <div className="form-group">
              <label className="form-label">Tax system</label>
              <select className="form-select" value={taxSystem} onChange={(e) => setTaxSystem(e.target.value)}>
                <option value="GST">GST (India — CGST/SGST/IGST)</option>
                <option value="VAT">VAT</option>
                <option value="SALES_TAX">Sales Tax</option>
                <option value="NONE">Tax exempt (0%)</option>
              </select>
            </div>
            {taxSystem === 'GST' && (
              <div className="form-group">
                <label className="form-label">GSTIN</label>
                <input className="form-input" value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="e.g. 29ABCDE1234F1Z5" />
                <span className="element-desc">Printed on invoices and receipts. Optional — leave blank if not registered.</span>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.3rem', marginTop: 0 }}>Business details</h2>
            <div className="form-group">
              <label className="form-label">Street address</label>
              <input className="form-input" value={street} onChange={(e) => setStreet(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">City</label>
                <input className="form-input" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <input className="form-input" value={state} onChange={(e) => setState(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Postal code</label>
                <input className="form-input" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h2 style={{ fontSize: '1.3rem', marginTop: 0 }}>Choose your modules</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Only the modules you enable will appear in your navigation. You can change this later in Organization Settings.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginTop: '1rem' }}>
              {ALL_MODULES.map((mod) => (
                <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', padding: '0.5rem 0.65rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={modules.includes(mod)} onChange={() => toggleModule(mod)} />
                  {MODULE_LABELS[mod] || mod}
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div>
            <h2 style={{ fontSize: '1.3rem', marginTop: 0 }}>Initial setup</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              These are optional starting points based on your enabled modules.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              {setupActions.map((a) => (
                <button key={a.path} className="btn btn-secondary" style={{ justifyContent: 'space-between', display: 'flex' }} onClick={() => onNavigate(a.path)}>
                  {a.label} <ArrowRight size={15} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AI assistant (optional) */}
        <div style={{ marginTop: '1.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setAiOpen((v) => !v)}>
            <Wand2 size={15} /> {aiOpen ? 'Hide' : 'Use'} AI setup assistant (optional)
          </button>
          {aiOpen && (
            <div style={{ marginTop: '0.75rem', background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Describe your business and the AI will suggest a starting configuration. You never need the AI to finish setup.
              </p>
              <textarea className="form-textarea" rows={2} value={aiDescription} onChange={(e) => setAiDescription(e.target.value)} placeholder="e.g. We run a neighbourhood supermarket with barcode checkout and daily cash shifts." />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={runAiAssistant} disabled={aiBusy || !aiDescription.trim()}>
                  {aiBusy ? <><RefreshCw size={14} className="animate-spin" /> Thinking...</> : <><Sparkles size={14} /> Suggest configuration</>}
                </button>
                {aiSuggestions && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Suggested model: <strong style={{ textTransform: 'capitalize' }}>{aiSuggestions.suggestedModel}</strong>
                  </span>
                )}
              </div>
              {aiError && (
                <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: 'var(--color-warning)', fontSize: '0.8rem' }}>
                  <AlertTriangle size={15} style={{ marginTop: '0.1rem' }} /> {aiError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
          <div>
            {step > 1 && step < 6 && (
              <button className="btn btn-secondary" onClick={() => goTo(step - 1)} disabled={saving}><ArrowLeft size={15} /> Back</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-ghost" onClick={handleSkip} disabled={saving}>Skip for now</button>
            {step < 6 ? (
              <button className="btn btn-primary" onClick={() => goTo(step + 1)} disabled={saving || (step === 2 && !businessName.trim())}>
                {saving ? 'Saving...' : 'Continue'} <ArrowRight size={15} />
              </button>
            ) : (
              <button className="btn btn-primary btn-lg" onClick={handleFinish} disabled={saving}>
                {saving ? <><RefreshCw size={16} className="animate-spin" /> Finishing...</> : <><CheckCircle2 size={16} /> Finish setup</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
