import React, { useState } from 'react';
import { apiRequest } from '../../api/client';
import { KeyRound, ArrowLeft } from 'lucide-react';

interface AuthPageProps {
  onNavigate: (path: string) => void;
}

/** Same dark card shell as the login page. */
const AuthShell: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #090d16 70%)',
    }}
  >
    <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '2.5rem', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-active)' }}>
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
            marginBottom: '1rem',
          }}
        >
          <KeyRound size={24} color="#fff" />
        </div>
        <h1 style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>{title}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{subtitle}</p>
      </div>
      {children}
    </div>
  </div>
);

const Notice: React.FC<{ tone: 'error' | 'success'; children: React.ReactNode }> = ({ tone, children }) => (
  <div
    role={tone === 'error' ? 'alert' : 'status'}
    style={{
      background: tone === 'error' ? 'var(--color-danger-bg)' : 'rgba(16, 185, 129, 0.12)',
      border: `1px solid ${tone === 'error' ? 'rgba(244, 63, 94, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
      color: tone === 'error' ? '#fca5a5' : '#6ee7b7',
      padding: '0.9rem 1rem',
      borderRadius: 'var(--radius-md)',
      fontSize: '0.85rem',
      marginBottom: '1.25rem',
      lineHeight: 1.5,
    }}
  >
    {children}
  </div>
);

const BackToLogin: React.FC<AuthPageProps> = ({ onNavigate }) => (
  <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
    <button
      type="button"
      onClick={() => onNavigate('/login')}
      style={{ background: 'none', border: 'none', color: 'var(--accent-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
    >
      <ArrowLeft size={14} /> Back to sign in
    </button>
  </div>
);

export const ForgotPasswordPage: React.FC<AuthPageProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    setLoading(false);
    if (res.success) setSent(true);
    else setError(res.error?.message || 'Could not start the password reset. Please try again.');
  };

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your account email and we'll send you a reset link.">
      {sent ? (
        <Notice tone="success">
          If an account exists for <strong>{email}</strong>, a reset link is on its way. The link expires in 1 hour. Check your spam folder if it doesn't arrive.
        </Notice>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="form-group">
            <label className="form-label" htmlFor="forgot-email">Email Address</label>
            <input id="forgot-email" type="email" className="form-input" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@yourcompany.com" />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', padding: '0.8rem' }} disabled={loading}>
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
      )}
      <BackToLogin onNavigate={onNavigate} />
    </AuthShell>
  );
};

export const ResetPasswordPage: React.FC<AuthPageProps> = ({ onNavigate }) => {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : 'This reset link is missing its token. Request a new link.');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('The two passwords do not match.');
    setLoading(true);
    setError(null);
    const res = await apiRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
    setLoading(false);
    if (res.success) setDone(true);
    else setError(res.error?.message || 'This reset link is invalid or has expired. Request a new one.');
  };

  return (
    <AuthShell title="Choose a new password" subtitle="You'll be signed out everywhere else once it's changed.">
      {done ? (
        <>
          <Notice tone="success">Your password has been updated. Sign in with your new password.</Notice>
          <button type="button" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem' }} onClick={() => onNavigate('/login')}>
            Go to sign in
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="form-group">
            <label className="form-label" htmlFor="reset-password">New password</label>
            <input id="reset-password" type="password" className="form-input" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reset-confirm">Confirm new password</label>
            <input id="reset-confirm" type="password" className="form-input" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', padding: '0.8rem' }} disabled={loading || !token}>
            {loading ? 'Saving...' : 'Update password'}
          </button>
          {!token && (
            <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: '0.75rem' }} onClick={() => onNavigate('/forgot-password')}>
              Request a new link
            </button>
          )}
        </form>
      )}
      <BackToLogin onNavigate={onNavigate} />
    </AuthShell>
  );
};
