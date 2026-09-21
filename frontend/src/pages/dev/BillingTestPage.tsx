import React, { useState } from 'react';
import { apiRequest } from '../../api/client';
import { Activity, Play, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const BillingTestPage: React.FC = () => {
  const { organization } = useAuth();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const runTests = async () => {
    setLoading(true);
    setResults([]);

    const runScenario = async (name: string, endpoint: string, body?: any) => {
      try {
        const res = await apiRequest(endpoint, {
          method: body ? 'POST' : 'GET',
          body: body ? JSON.stringify(body) : undefined,
        });
        setResults((prev) => [...prev, { name, success: res.success, message: res.success ? 'Passed' : res.error?.message }]);
      } catch (err: any) {
        setResults((prev) => [...prev, { name, success: false, message: err.message }]);
      }
    };

    await runScenario('Tenant Isolation: Fetch Dashboard Summary', '/reports/dashboard-summary');
    await runScenario('Billing Engine: Test Payment Sandbox', '/payments/test-checkout', { invoiceId: 'test_invoice_123', amount: 100 });
    
    // Test AI module tracking
    await runScenario('AI Module Audit: Enable AI Copilot', '/organizations/me', {
      enabledModules: [...(organization?.enabledModules || []), 'ai_copilot'],
      _enabledByAi: true
    });

    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity color="var(--accent-primary)" /> Billing Engine Test Sandbox
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Run live integration tests against the current tenant's database schema.
          </p>
        </div>
        <button className="btn btn-primary" onClick={runTests} disabled={loading}>
          {loading ? 'Running...' : 'Run All Test Scenarios'}
          <Play size={16} />
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Test Results: {organization?.name} ({organization?.businessType})</h3>
        
        {results.length === 0 && !loading && (
          <p style={{ color: 'var(--text-muted)' }}>No tests run yet. Click the button above to begin.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {results.map((r, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1rem', background: '#f8fafc', border: `1px solid ${r.success ? '#bbf7d0' : '#fecdd3'}`,
              borderRadius: 'var(--radius-md)'
            }}>
              <div style={{ fontWeight: 600 }}>{r.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: r.success ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {r.success ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                {r.message}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
