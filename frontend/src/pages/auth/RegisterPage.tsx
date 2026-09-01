import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api/client';
import { Sparkles, ArrowRight, Layers } from 'lucide-react';
import { BillingModelType } from '@billing/shared';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { login } = useAuth();
  const [organizationName, setOrganizationName] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [billingModel, setBillingModel] = useState<BillingModelType>('subscription');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ organizationName, name, email, password, billingModel }),
      });

      if (res.success && res.data) {
        login(res.data.token, res.data.user, res.data.organization);
        onNavigate('/onboarding');
      } else {
        setError(res.error?.message || 'Registration failed');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #090d16 70%)',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '2.5rem',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-active)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '3.25rem',
              height: '3.25rem',
              borderRadius: '16px',
              background: 'var(--accent-gradient)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--accent-glow)',
              marginBottom: '0.75rem',
            }}
          >
            <Sparkles size={24} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: '0.3rem' }}>Create Organization</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Instant AI onboarding & dynamic schema setup
          </p>
        </div>

        {error && (
          <div
            style={{
              background: 'var(--color-danger-bg)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: 'var(--color-danger)',
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">Company / Organization Name</label>
            <input
              type="text"
              className="form-input"
              required
              placeholder="e.g. Apex Global Logistics"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Your Name</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="Sarah Chen"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Work Email</label>
              <input
                type="email"
                className="form-input"
                required
                placeholder="admin@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Layers size={14} color="var(--accent-secondary)" /> Initial Billing Model
            </label>
            <select
              className="form-select"
              value={billingModel}
              onChange={(e) => setBillingModel(e.target.value as BillingModelType)}
            >
              <option value="subscription">SaaS & Recurring Subscriptions</option>
              <option value="retail">Retail & Point-of-Sale</option>
              <option value="rental">Rental & Equipment Leasing</option>
              <option value="logistics">Logistics & Freight Billing</option>
              <option value="professional_services">Professional Services & Consulting</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1.25rem', padding: '0.8rem' }}
            disabled={loading}
          >
            {loading ? 'Configuring Tenant Environment...' : 'Deploy Tenant Workspace'} <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <button
            onClick={() => onNavigate('/login')}
            style={{ background: 'none', border: 'none', color: 'var(--accent-secondary)', fontWeight: 600, cursor: 'pointer' }}
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
