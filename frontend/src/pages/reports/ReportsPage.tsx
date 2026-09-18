import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { Customer } from '@billing/shared';
import {
  TrendingUp,
  Clock,
  PieChart,
  Users,
  FileText,
  Printer,
  Download,
  Calendar,
  DollarSign,
  ShieldCheck,
} from 'lucide-react';

interface RevenuePoint {
  period: string;
  totalRevenue: number;
  taxTotal: number;
  invoiceCount: number;
}

interface ARAgingData {
  totalReceivables: number;
  totalOverdue: number;
  buckets: {
    current: { label: string; amount: number; count: number; invoices: any[] };
    days30to60: { label: string; amount: number; count: number; invoices: any[] };
    days60to90: { label: string; amount: number; count: number; invoices: any[] };
    days90Plus: { label: string; amount: number; count: number; invoices: any[] };
  };
}

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'revenue' | 'aging' | 'statement' | 'top_clients'>('revenue');
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [agingData, setAgingData] = useState<ARAgingData | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Statement Generator State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [statementData, setStatementData] = useState<any>(null);
  const [loadingStatement, setLoadingStatement] = useState<boolean>(false);

  const loadReports = async () => {
    try {
      const [revRes, agingRes, custRes] = await Promise.all([
        apiRequest<RevenuePoint[]>('/reports/revenue'),
        apiRequest<ARAgingData>('/reports/ar-aging'),
        apiRequest<Customer[]>('/reports/top-customers'),
      ]);

      if (revRes.success && revRes.data) setRevenueData(revRes.data);
      if (agingRes.success && agingRes.data) setAgingData(agingRes.data);
      if (custRes.success && custRes.data) setCustomers(custRes.data);
    } catch (e) {
      console.error('Failed to load reports', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleGenerateStatement = async (custId: string) => {
    setSelectedCustomerId(custId);
    if (!custId) {
      setStatementData(null);
      return;
    }

    setLoadingStatement(true);
    try {
      const res = await apiRequest(`/reports/customer-statement/${custId}`);
      if (res.success && res.data) {
        setStatementData(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStatement(false);
    }
  };

  const totalYearlyRevenue = revenueData.reduce((sum, r) => sum + r.totalRevenue, 0);
  const totalTaxCollected = revenueData.reduce((sum, r) => sum + r.taxTotal, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Financial Intelligence & Reports</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
            Executive revenue analytics, AR aging distribution, GST tax liability & customer ledgers
          </p>
        </div>

        <button className="btn btn-secondary" onClick={() => window.print()}>
          <Printer size={15} /> Print Report Overview
        </button>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        {[
          { id: 'revenue', label: 'Revenue Trends & GST', icon: TrendingUp },
          { id: 'aging', label: 'Accounts Receivable (AR) Aging', icon: Clock },
          { id: 'statement', label: 'Customer Account Statement', icon: FileText },
          { id: 'top_clients', label: 'Top Accounts by Volume', icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="btn btn-sm"
              style={{
                background: isActive ? 'var(--accent-primary)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                border: 'none',
              }}
            >
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: REVENUE TRENDS & GST BREAKDOWN */}
      {activeTab === 'revenue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Total Invoiced Revenue</span>
                <DollarSign size={18} color="var(--accent-primary)" />
              </div>
              <div className="kpi-value">₹{totalYearlyRevenue.toLocaleString()}</div>
              <div className="kpi-desc">Across all invoiced periods</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">GST Tax Liability Collected</span>
                <ShieldCheck size={18} color="var(--color-success)" />
              </div>
              <div className="kpi-value" style={{ color: 'var(--color-success)' }}>
                ₹{totalTaxCollected.toLocaleString()}
              </div>
              <div className="kpi-desc">CGST, SGST & IGST combined</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Active Reporting Periods</span>
                <Calendar size={18} color="var(--text-muted)" />
              </div>
              <div className="kpi-value">{revenueData.length || 1} Months</div>
              <div className="kpi-desc">Aggregated historical telemetry</div>
            </div>
          </div>

          {/* Revenue Breakdown Table */}
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Invoices Issued</th>
                  <th>Taxable Volume</th>
                  <th>GST Tax Amount</th>
                  <th>Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {revenueData.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No finalized invoices recorded in this period.
                    </td>
                  </tr>
                ) : (
                  revenueData.map((r, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700 }}>{r.period}</td>
                      <td>{r.invoiceCount} invoices</td>
                      <td className="num-mono">₹{(r.totalRevenue - r.taxTotal).toLocaleString()}</td>
                      <td className="num-mono" style={{ color: 'var(--color-success)' }}>₹{r.taxTotal.toLocaleString()}</td>
                      <td className="num-mono" style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '0.95rem' }}>
                        ₹{r.totalRevenue.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: AR AGING MATRIX */}
      {activeTab === 'aging' && agingData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <div className="kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
              <span className="kpi-title">Current (0-30 Days)</span>
              <div className="kpi-value" style={{ color: '#10b981' }}>
                ₹{agingData.buckets.current.amount.toLocaleString()}
              </div>
              <div className="kpi-desc">{agingData.buckets.current.count} open invoices</div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <span className="kpi-title">31-60 Days Overdue</span>
              <div className="kpi-value" style={{ color: '#f59e0b' }}>
                ₹{agingData.buckets.days30to60.amount.toLocaleString()}
              </div>
              <div className="kpi-desc">{agingData.buckets.days30to60.count} open invoices</div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '4px solid #ea580c' }}>
              <span className="kpi-title">61-90 Days Overdue</span>
              <div className="kpi-value" style={{ color: '#ea580c' }}>
                ₹{agingData.buckets.days60to90.amount.toLocaleString()}
              </div>
              <div className="kpi-desc">{agingData.buckets.days60to90.count} open invoices</div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '4px solid #e11d48' }}>
              <span className="kpi-title">90+ Days Overdue</span>
              <div className="kpi-value" style={{ color: '#e11d48' }}>
                ₹{agingData.buckets.days90Plus.amount.toLocaleString()}
              </div>
              <div className="kpi-desc">{agingData.buckets.days90Plus.count} critical risk</div>
            </div>
          </div>

          {/* Drill-down Overdue Accounts */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 1rem' }}>Overdue Invoices Requiring Follow-up</h3>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Customer Name</th>
                    <th>Due Date</th>
                    <th>Days Overdue</th>
                    <th>Amount Due</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...agingData.buckets.days30to60.invoices,
                    ...agingData.buckets.days60to90.invoices,
                    ...agingData.buckets.days90Plus.invoices,
                  ].length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        🎉 Great news! No overdue accounts detected.
                      </td>
                    </tr>
                  ) : (
                    [
                      ...agingData.buckets.days30to60.invoices,
                      ...agingData.buckets.days60to90.invoices,
                      ...agingData.buckets.days90Plus.invoices,
                    ].map((inv, i) => (
                      <tr key={i}>
                        <td className="num-mono" style={{ fontWeight: 700 }}>#{inv.invoiceNumber}</td>
                        <td>{inv.customerName}</td>
                        <td className="num-mono" style={{ fontSize: '0.8rem' }}>{inv.dueDate}</td>
                        <td>
                          <span className="badge badge-overdue">{inv.daysOverdue} days</span>
                        </td>
                        <td className="num-mono" style={{ fontWeight: 700, color: 'var(--color-danger)' }}>
                          ₹{inv.amountDue.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOMER ACCOUNT STATEMENT */}
      {activeTab === 'statement' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <label className="form-label" style={{ marginBottom: '0.4rem' }}>Select Client Account for Statement Generation</label>
            <select
              className="form-select"
              style={{ maxWidth: '400px' }}
              value={selectedCustomerId}
              onChange={(e) => handleGenerateStatement(e.target.value)}
            >
              <option value="">-- Choose Customer --</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} {c.companyName ? `(${c.companyName})` : ''} - Outstanding: ₹{c.outstandingBalance.toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          {loadingStatement ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Compiling running ledger statement...
            </div>
          ) : statementData ? (
            <div className="invoice-paper" style={{ padding: '2.5rem', background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--accent-primary)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.4rem', margin: 0 }}>ACCOUNT STATEMENT OF LEDGER</h2>
                  <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.35rem' }}>
                    {statementData.customer?.name} ({statementData.customer?.companyName || 'Corporate Client'})
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    GSTIN: {statementData.customer?.gstinOrTaxId || 'Unregistered'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current Net Outstanding:</div>
                  <div className="num-mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                    ₹{statementData.currentOutstanding.toLocaleString()}
                  </div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Transaction Type</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Reference</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Debit (Invoiced)</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Credit (Paid)</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {statementData.ledger?.map((entry: any, eIdx: number) => (
                    <tr key={eIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td className="num-mono" style={{ padding: '0.65rem 0.75rem' }}>{entry.date}</td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <span className={`badge ${entry.type === 'INVOICE' ? 'badge-draft' : 'badge-paid'}`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="num-mono" style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>{entry.reference}</td>
                      <td className="num-mono" style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                        {entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '-'}
                      </td>
                      <td className="num-mono" style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: 'var(--color-success)' }}>
                        {entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '-'}
                      </td>
                      <td className="num-mono" style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>
                        ₹{entry.runningBalance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Select a customer above to view complete financial statement.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: TOP ACCOUNTS */}
      {activeTab === 'top_clients' && (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer / Organization</th>
                <th>Email</th>
                <th>State & Jurisdiction</th>
                <th>GSTIN</th>
                <th>Outstanding Receivables</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c._id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{c.name}</div>
                    {c.companyName && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.companyName}</div>}
                  </td>
                  <td>{c.email}</td>
                  <td>{c.billingAddress?.state || 'Local State'}</td>
                  <td className="num-mono">{c.gstinOrTaxId || 'Unregistered'}</td>
                  <td className="num-mono" style={{ fontWeight: 700, color: c.outstandingBalance > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    ₹{c.outstandingBalance.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
