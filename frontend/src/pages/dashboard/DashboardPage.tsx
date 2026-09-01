import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { DashboardSummary } from '@billing/shared';
import {
  TrendingUp,
  CreditCard,
  AlertTriangle,
  FileText,
  Sparkles,
  ArrowUpRight,
  ShieldAlert,
  Calendar,
  Users,
  CheckCircle2,
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await apiRequest<DashboardSummary>('/reports/dashboard-summary');
        if (res.success && res.data) {
          setSummary(res.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-secondary)' }}>
        <Sparkles size={32} className="animate-spin" color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
        <p style={{ fontWeight: 600 }}>Loading AI Financial Intelligence...</p>
        <p className="element-desc">Aggregating live invoice receivables and transaction records</p>
      </div>
    );
  }

  const kpis = summary?.kpis;
  const brief = summary?.aiDailyBrief;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Page Title & Context Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Executive Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Real-time billing performance, AI cashflow projections, anomaly detection, and accounts receivable overview.
        </p>
      </div>

      {/* AI Daily Briefing Banner */}
      {brief && (
        <div
          className="glass-panel"
          style={{
            padding: '1.75rem',
            background: '#ffffff',
            border: '1px solid #c7d2fe',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={20} color="#fff" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', margin: 0, color: 'var(--text-primary)' }}>AI Executive Briefing</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Automated financial intelligence computed from real-time database ledgers
                </p>
              </div>
            </div>
            <span className="badge badge-paid">Live Engine Active</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.875rem', marginTop: '1rem' }}>
            {brief.summaryBullets.map((bullet, idx) => (
              <div
                key={idx}
                style={{
                  background: '#f8fafc',
                  padding: '0.875rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.825rem',
                  color: 'var(--text-primary)',
                  border: '1px solid #e2e8f0',
                  lineHeight: '1.45',
                }}
              >
                {bullet}
              </div>
            ))}
          </div>

          {/* Priority Action Triggers */}
          {brief.priorityActions && brief.priorityActions.length > 0 && (
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                AI Recommended Priority Actions:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                {brief.priorityActions.map((action, idx) => (
                  <button
                    key={idx}
                    className={`btn ${action.urgency === 'high' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => action.linkTo && onNavigate(action.linkTo)}
                  >
                    {action.urgency === 'high' && <AlertTriangle size={14} />}
                    {action.action}
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        {/* Total Invoiced */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Invoiced</span>
            <TrendingUp size={18} color="var(--accent-primary)" />
          </div>
          <div className="kpi-value">₹{(kpis?.totalRevenue || 0).toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 600 }}>
            +{kpis?.revenueGrowthMoM}% Month-over-Month
          </div>
          <p className="kpi-desc">Total cumulative gross billed across all client accounts</p>
        </div>

        {/* Total Outstanding */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Outstanding Receivables</span>
            <CreditCard size={18} color="var(--color-warning)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>
            ₹{(kpis?.totalOutstanding || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {kpis?.pendingInvoicesCount} invoices pending settlement
          </div>
          <p className="kpi-desc">Expected cash inflow from issued and partially paid invoices</p>
        </div>

        {/* Overdue Amount */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Overdue Balance</span>
            <AlertTriangle size={18} color="var(--color-danger)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>
            ₹{(kpis?.overdueAmount || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600 }}>
            Follow-Up Required
          </div>
          <p className="kpi-desc">Invoices past payment terms exceeding contractual due date</p>
        </div>

        {/* Active Accounts */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Active Accounts</span>
            <Users size={18} color="var(--accent-primary)" />
          </div>
          <div className="kpi-value">{kpis?.activeCustomersCount || 0}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {kpis?.paidInvoicesCount} invoices fully settled
          </div>
          <p className="kpi-desc">Total active corporate clients registered in tenant directory</p>
        </div>
      </div>

      {/* Cashflow Forecast & Anomaly Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '1.5rem' }}>
        {/* Cashflow Projection Bar Visualizer */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>4-Week Cashflow Projection</h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AI Forecast Engine</span>
          </div>
          <p className="section-lead">
            Predicts incoming cash collections versus projected operational outlays based on invoice payment history.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {summary?.cashflowProjection?.dates.map((date, idx) => {
              const inflow = summary.cashflowProjection.projectedInflow[idx] || 0;
              const outflow = summary.cashflowProjection.projectedOutflow[idx] || 0;
              const maxVal = 100000;
              const inflowPercent = Math.min(100, (inflow / maxVal) * 100);
              const outflowPercent = Math.min(100, (outflow / maxVal) * 100);

              return (
                <div key={date}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{date}</span>
                    <span>
                      <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Inflow: ₹{inflow.toLocaleString()}</span>
                      <span style={{ color: 'var(--text-muted)', margin: '0 0.5rem' }}>•</span>
                      <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Outflow: ₹{outflow.toLocaleString()}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', height: '10px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${inflowPercent}%`, background: 'var(--color-success)', borderRadius: '6px' }} title="Projected Inflow" />
                    <div style={{ width: `${outflowPercent}%`, background: 'var(--color-danger)', borderRadius: '6px' }} title="Projected Outflow" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Anomaly & Risk Alerts */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <ShieldAlert size={18} color="var(--color-danger)" />
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Active Risk & Anomaly Alerts</h3>
          </div>
          <p className="section-lead">Flags payment delays and unusual discount deviations.</p>

          {summary?.anomalies && summary.anomalies.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {summary.anomalies.map((anomaly) => (
                <div
                  key={anomaly.id}
                  style={{
                    background: anomaly.severity === 'high' ? '#fff1f2' : '#fefce8',
                    border: `1px solid ${anomaly.severity === 'high' ? '#fecdd3' : '#fef08a'}`,
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>{anomaly.title}</span>
                    <span className="badge badge-overdue" style={{ fontSize: '0.65rem' }}>
                      {anomaly.severity} priority
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.4rem' }}>{anomaly.description}</p>
                  <div style={{ fontSize: '0.725rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                    Recommended Action: {anomaly.suggestedAction}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <CheckCircle2 size={24} color="var(--color-success)" style={{ marginBottom: '0.5rem' }} />
              <p>No critical financial anomalies detected.</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Invoices Table */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={18} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Recent Invoices</h3>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('/invoices')}>
            View All Invoices in Studio
          </button>
        </div>
        <p className="section-lead">Latest billing transactions snapshotted in the ledger.</p>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer & Company</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Grand Total (₹)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {summary?.recentInvoices?.map((inv: any) => (
                <tr key={inv._id}>
                  <td style={{ fontWeight: 600, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                    {inv.invoiceNumber}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{inv.customerSnapshot?.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{inv.customerSnapshot?.companyName}</div>
                  </td>
                  <td>{inv.issueDate}</td>
                  <td>{inv.dueDate}</td>
                  <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    ₹{(inv.grandTotal || 0).toLocaleString()}
                  </td>
                  <td>
                    <span className={`badge badge-${inv.status}`}>{inv.status.replace('_', ' ')}</span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => onNavigate(`/invoices/${inv._id}`)}>
                      Open Studio
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
