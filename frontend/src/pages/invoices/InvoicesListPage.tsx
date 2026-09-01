import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { Invoice } from '@billing/shared';
import { Plus, Search, FileText, ArrowRight } from 'lucide-react';

interface InvoicesListPageProps {
  onNavigate: (path: string) => void;
}

export const InvoicesListPage: React.FC<InvoicesListPageProps> = ({ onNavigate }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      let endpoint = `/invoices?search=${encodeURIComponent(search)}`;
      if (statusFilter !== 'all') {
        endpoint += `&status=${statusFilter}`;
      }
      const res = await apiRequest<Invoice[]>(endpoint);
      if (res.success && res.data) {
        setInvoices(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter, search]);

  const statuses = ['all', 'draft', 'pending_approval', 'sent', 'partially_paid', 'paid', 'overdue'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Invoicing Studio</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
            Multi-tenant deterministic invoice generator with immutable snapshotting and GST/VAT compliance.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => onNavigate('/invoices/create')}>
          <Plus size={18} /> Create New Invoice
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        {/* Status Pills */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.25rem' }}>Status:</span>
          {statuses.map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className="btn btn-sm"
              style={{
                background: statusFilter === st ? 'var(--accent-primary)' : '#ffffff',
                color: statusFilter === st ? '#ffffff' : 'var(--text-secondary)',
                border: `1px solid ${statusFilter === st ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                textTransform: 'capitalize',
                fontWeight: statusFilter === st ? 700 : 500,
              }}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '280px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.25rem' }}
              placeholder="Search invoice # or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Invoices Data Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice Number</th>
                <th>Client / Account</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Grand Total (₹)</th>
                <th>Amount Due (₹)</th>
                <th>Status</th>
                <th>AI Risk Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                    Loading invoices from tenant ledger...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                    No invoices matching current filter.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv._id}>
                    <td style={{ fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                      {inv.invoiceNumber}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{inv.customerSnapshot?.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {inv.customerSnapshot?.companyName || inv.customerSnapshot?.email}
                      </div>
                    </td>
                    <td>{inv.issueDate}</td>
                    <td>{inv.dueDate}</td>
                    <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      ₹{inv.grandTotal.toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: inv.amountDue > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                      ₹{inv.amountDue.toLocaleString()}
                    </td>
                    <td>
                      <span className={`badge badge-${inv.status}`}>{inv.status.replace('_', ' ')}</span>
                    </td>
                    <td>
                      {inv.aiRiskScore && (
                        <span
                          className={`badge ${
                            inv.aiRiskScore === 'HIGH'
                              ? 'badge-overdue'
                              : inv.aiRiskScore === 'MEDIUM'
                              ? 'badge-partially_paid'
                              : 'badge-paid'
                          }`}
                          style={{ fontSize: '0.65rem' }}
                          title={inv.aiRiskExplanation || 'AI payment delay risk score'}
                        >
                          {inv.aiRiskScore}
                        </span>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => onNavigate(`/invoices/${inv._id}`)}>
                        <span>Open Details</span>
                        <ArrowRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
