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

    const runScenario = async (name: string, assertionFunc: () => Promise<{ expected: any, actual: any, status: boolean, msg?: string }>) => {
      try {
        const { expected, actual, status, msg } = await assertionFunc();
        setResults((prev) => [...prev, { name, success: status, expected: JSON.stringify(expected), actual: JSON.stringify(actual), message: msg || (status ? 'Passed' : 'Assertion failed') }]);
      } catch (err: any) {
        setResults((prev) => [...prev, { name, success: false, expected: 'N/A', actual: 'Error', message: err.message }]);
      }
    };

    await runScenario('Tenant Isolation: Fetch Customers', async () => {
      const res = await apiRequest('/customers');
      const isArray = Array.isArray(res.data);
      return { expected: 'Array of customers', actual: isArray ? `Array[${res.data.length}]` : typeof res.data, status: isArray && res.success };
    });

    await runScenario('Billing Engine: Reject missing invoice', async () => {
      const res = await apiRequest('/payments/test-checkout', { method: 'POST', body: JSON.stringify({ invoiceId: '000000000000000000000000', amount: 100 }) });
      return { expected: 'NOT_FOUND', actual: res.error?.code, status: res.error?.code === 'NOT_FOUND' };
    });

    await runScenario('AI Module Tracker: System deterministic fallback', async () => {
      const orgState = await apiRequest('/organizations/profile');
      const modules = orgState.data?.enabledModules || [];
      const res = await apiRequest('/organizations/settings', {
        method: 'PATCH',
        body: JSON.stringify({ enabledModules: [...modules, 'ai_copilot'], _enabledBySystem: true })
      });
      const audit = res.data?.moduleAudit?.find((a: any) => a.moduleId === 'ai_copilot');
      return { expected: 'system', actual: audit?.enabledBy, status: audit?.enabledBy === 'system' };
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
              display: 'flex', flexDirection: 'column', gap: '0.5rem',
              padding: '1rem', background: '#f8fafc', border: `1px solid ${r.success ? '#bbf7d0' : '#fecdd3'}`,
              borderRadius: 'var(--radius-md)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                <span>{r.name}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: r.success ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {r.success ? <CheckCircle2 size={18} /> : <XCircle size={18} />} {r.message}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div><strong>Expected:</strong> <code>{r.expected}</code></div>
                <div><strong>Actual:</strong> <code>{r.actual}</code></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
