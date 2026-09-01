import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api/client';
import { Sparkles, CheckCircle2, ArrowRight, Wand2, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';

interface OnboardingPageProps {
  onNavigate: (path: string) => void;
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ onNavigate }) => {
  const { organization, updateOrganization } = useAuth();
  const [businessDescription, setBusinessDescription] = useState<string>(
    'We provide cloud infrastructure subscriptions, DevOps retainers, and SOC2 compliance audit packages to tech startups.'
  );
  const [industry, setIndustry] = useState<string>('Technology');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [matchResult, setMatchResult] = useState<any>(null);
  const [isActivating, setIsActivating] = useState<boolean>(false);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const res = await apiRequest('/ai/onboarding/suggest-model', {
        method: 'POST',
        body: JSON.stringify({ businessDescription, industry }),
      });
      if (res.success && res.data) {
        setMatchResult(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleActivateModel = async () => {
    if (!matchResult) return;
    setIsActivating(true);

    try {
      const res = await apiRequest('/organizations/switch-model', {
        method: 'POST',
        body: JSON.stringify({ billingModel: matchResult.suggestedModel }),
      });

      if (res.success && res.data) {
        updateOrganization(res.data);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        setTimeout(() => {
          onNavigate('/dashboard');
        }, 1200);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div style={{ maxWidth: '850px', margin: '1rem auto' }}>
      {/* Wizard Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div
          style={{
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: '20px',
            background: 'var(--accent-gradient)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--accent-glow)',
            marginBottom: '1rem',
          }}
        >
          <Wand2 size={28} color="#fff" />
        </div>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>AI-Driven Business Adaptation</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '600px', margin: '0 auto' }}>
          Describe your revenue model in natural language. Our dynamic engine will select the optimal billing schema, configure custom metadata fields, and tailor the platform to your exact operations.
        </p>
      </div>

      {/* Step 1: Business Discovery */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={18} color="var(--accent-secondary)" /> Step 1: Tell Us About Your Business
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          How do you sell and bill your customers? (e.g. monthly subscriptions, rental periods with deposits, freight per ton, hourly consulting)
        </p>

        <div className="form-group">
          <label className="form-label">Business & Billing Model Description</label>
          <textarea
            className="form-textarea"
            rows={3}
            value={businessDescription}
            onChange={(e) => setBusinessDescription(e.target.value)}
            placeholder="e.g. We rent construction cranes and machinery with daily hire rates and refundable security deposits..."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['SaaS & Subscriptions', 'Rental Leasing', 'Logistics Freight', 'Retail Counter'].map((chip) => (
              <button
                key={chip}
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (chip === 'SaaS & Subscriptions') {
                    setBusinessDescription('We offer SaaS tiered plans with seat licensing and annual recurring renewal.');
                  } else if (chip === 'Rental Leasing') {
                    setBusinessDescription('We rent AV equipment and studio space with security deposits and daily rental periods.');
                  } else if (chip === 'Logistics Freight') {
                    setBusinessDescription('We operate interstate truck freight billing per ton per kilometer with toll surcharges.');
                  } else {
                    setBusinessDescription('We run a retail electronics showroom with barcode scanning and instant GST receipts.');
                  }
                }}
                style={{ border: '1px solid var(--border-subtle)' }}
              >
                {chip}
              </button>
            ))}
          </div>

          <button className="btn btn-primary" onClick={handleAnalyze} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <>
                <RefreshCw size={16} className="animate-spin" /> Analyzing Model...
              </>
            ) : (
              <>
                <Sparkles size={16} /> Match Billing Architecture
              </>
            )}
          </button>
        </div>
      </div>

      {/* Step 2: AI Matching Result */}
      {matchResult && (
        <div
          className="glass-panel animate-fade-in"
          style={{ padding: '2rem', border: '1px solid var(--border-active)', marginBottom: '2rem' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--text-primary)',
                }}
              >
                {matchResult.preset.name}
              </span>
              <span className="badge badge-paid">
                <CheckCircle2 size={13} /> {matchResult.matchScore}% Match
              </span>
            </div>
            <span className="badge badge-model">{matchResult.preset.industry}</span>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            {matchResult.reason} {matchResult.preset.description}
          </p>

          {/* Preset Custom Fields Preview */}
          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--accent-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
              Auto-Configured Dynamic Schema & Custom Fields:
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {matchResult.preset.suggestedCustomFields.map((field: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-subtle)',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{field.label}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Entity: <code>{field.targetEntity}</code> • Type: <code>{field.fieldType}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Call to action */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button className="btn btn-secondary" onClick={() => onNavigate('/dashboard')}>
              Skip & Keep Current Defaults
            </button>
            <button className="btn btn-primary btn-lg" onClick={handleActivateModel} disabled={isActivating}>
              {isActivating ? 'Provisioning Model...' : 'Apply Architecture & Launch Workspace'}{' '}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
