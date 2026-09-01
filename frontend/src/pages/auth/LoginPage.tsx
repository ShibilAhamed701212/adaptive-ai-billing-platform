import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api/client';
import { Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

interface LoginPageProps {
  onNavigate: (path: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState<string>('admin@nexuscloud.io');
  const [password, setPassword] = useState<string>('Admin@123456');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (res.success && res.data) {
        login(res.data.token, res.data.user, res.data.organization);
        onNavigate('/dashboard');
      } else {
        setError(res.error?.message || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
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
          maxWidth: '460px',
          padding: '2.5rem',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-active)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
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
              marginBottom: '1rem',
            }}
          >
            <Sparkles size={26} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>Welcome Back</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Adaptive AI-Powered Multi-Tenant Billing Platform
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

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@yourcompany.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem', padding: '0.8rem' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In to Workspace'} <ArrowRight size={16} />
          </button>
        </form>

        {/* Demo Creds helper */}
        <div
          style={{
            marginTop: '1.5rem',
            padding: '0.9rem',
            background: 'rgba(99, 102, 241, 0.08)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            fontSize: '0.78rem',
            color: '#c7d2fe',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, marginBottom: '0.3rem' }}>
            <ShieldCheck size={14} /> Preloaded Demo Credentials:
          </div>
          <div>Admin: <code>admin@nexuscloud.io</code> / <code>Admin@123456</code></div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Need a new organization?{' '}
          <button
            onClick={() => onNavigate('/register')}
            style={{ background: 'none', border: 'none', color: 'var(--accent-secondary)', fontWeight: 600, cursor: 'pointer' }}
          >
            Register Tenant
          </button>
        </div>
      </div>
    </div>
  );
};
