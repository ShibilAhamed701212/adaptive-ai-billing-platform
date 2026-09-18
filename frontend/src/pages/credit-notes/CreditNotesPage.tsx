import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { CreditNote, Invoice } from '@billing/shared';
import {
  FileMinus,
  Plus,
  Search,
  CheckCircle2,
  Printer,
  Download,
  AlertTriangle,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CreditNotesPageProps {
  onNavigate?: (path: string) => void;
}

export const CreditNotesPage: React.FC<CreditNotesPageProps> = ({ onNavigate }) => {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Issue Credit Note Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [reason, setReason] = useState<string>('Damaged Goods / Price Correction');
  const [amount, setAmount] = useState<number>(0);
  const [autoApply, setAutoApply] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Selected note for viewing
  const [selectedNote, setSelectedNote] = useState<CreditNote | null>(null);

  const loadData = async () => {
    try {
      const [cnRes, invRes] = await Promise.all([
        apiRequest<CreditNote[]>('/credit-notes'),
        apiRequest<Invoice[]>('/invoices'),
      ]);

      if (cnRes.success && cnRes.data) setCreditNotes(cnRes.data);
      if (invRes.success && invRes.data) setInvoices(invRes.data);
    } catch (e) {
      console.error('Error loading credit notes', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId || amount <= 0) return;

    setIsSubmitting(true);
    try {
      const res = await apiRequest<CreditNote>('/credit-notes', {
        method: 'POST',
        body: JSON.stringify({
          originalInvoiceId: selectedInvoiceId,
          reason,
          items: [
            {
              description: reason,
              quantity: 1,
              unitPrice: amount,
              taxRate: 0,
            },
          ],
          autoApply,
        }),
      });

      if (res.success) {
        confetti({ particleCount: 90, spread: 60 });
        setIsModalOpen(false);
        setSelectedInvoiceId('');
        setAmount(0);
        loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredNotes = creditNotes.filter((cn) => {
    return (
      !searchTerm ||
      cn.creditNoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cn.reason.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const totalCreditIssued = creditNotes.reduce((sum, c) => sum + (c.totalAmount || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Credit Notes & Rebates</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
            Issue GST-compliant credit notes and settle account balances against original tax invoices
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={15} /> Issue Credit Note
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Credit Issued</span>
            <FileMinus size={18} color="var(--color-warning)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>
            ₹{totalCreditIssued.toLocaleString()}
          </div>
          <div className="kpi-desc">Total balance reduction across accounts</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Credit Notes Count</span>
            <CheckCircle2 size={18} color="var(--accent-primary)" />
          </div>
          <div className="kpi-value">{creditNotes.length}</div>
          <div className="kpi-desc">Issued adjustment documents</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by credit note number, reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {/* Credit Note Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Credit Note #</th>
              <th>Original Invoice</th>
              <th>Reason</th>
              <th>Issued Date</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Loading credit notes...
                </td>
              </tr>
            ) : filteredNotes.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No credit notes issued.
                </td>
              </tr>
            ) : (
              filteredNotes.map((cn) => (
                <tr key={cn._id}>
                  <td>
                    <div className="num-mono" style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-secondary)' }}>
                      {cn.creditNoteNumber}
                    </div>
                  </td>
                  <td>
                    {onNavigate ? (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: 0, color: 'var(--accent-primary)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
                        onClick={() => onNavigate(`/invoices/${cn.originalInvoiceId}`)}
                      >
                        #{String(cn.originalInvoiceId).substring(18)}
                      </button>
                    ) : (
                      <span className="num-mono" style={{ fontSize: '0.8rem' }}>#{String(cn.originalInvoiceId).substring(18)}</span>
                    )}
                  </td>
                  <td>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{cn.reason}</div>
                  </td>
                  <td className="num-mono" style={{ fontSize: '0.8rem' }}>
                    {new Date(cn.createdAt).toLocaleDateString()}
                  </td>
                  <td className="num-mono" style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-warning)' }}>
                    ₹{cn.totalAmount.toLocaleString()}
                  </td>
                  <td>
                    <span className="badge badge-paid" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                      {cn.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedNote(cn)}
                    >
                      <Printer size={13} /> View Slip
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Issue Credit Note Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Issue Credit Note</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCreditNote}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Original Tax Invoice *</label>
                <select
                  className="form-select"
                  required
                  value={selectedInvoiceId}
                  onChange={(e) => {
                    setSelectedInvoiceId(e.target.value);
                    const inv = invoices.find((i) => i._id === e.target.value);
                    if (inv) setAmount(inv.amountDue || inv.grandTotal);
                  }}
                >
                  <option value="">-- Choose Invoice --</option>
                  {invoices.map((inv) => (
                    <option key={inv._id} value={inv._id}>
                      #{inv.invoiceNumber} - {inv.customerSnapshot?.name} (Total: ₹{inv.grandTotal.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Credit Amount (₹) *</label>
                <input
                  type="number"
                  className="form-input num-mono"
                  required
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Reason for Credit Note *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoApply}
                    onChange={(e) => setAutoApply(e.target.checked)}
                  />
                  Automatically apply deduction to invoice balance & customer ledger
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Issuing...' : 'Issue Credit Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit Note View Modal */}
      {selectedNote && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Credit Note</h3>
                <span className="num-mono" style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                  {selectedNote.creditNoteNumber}
                </span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedNote(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Date:</span>
                <span>{new Date(selectedNote.createdAt).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Original Invoice ID:</span>
                <span className="num-mono">#{String(selectedNote.originalInvoiceId).substring(18)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Reason:</span>
                <span style={{ fontWeight: 600 }}>{selectedNote.reason}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem', fontWeight: 700, fontSize: '1.05rem' }}>
                <span>Credit Amount:</span>
                <span style={{ color: 'var(--color-warning)', fontFamily: 'var(--font-mono)' }}>
                  ₹{selectedNote.totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={15} /> Print Slip
              </button>
              <button className="btn btn-primary" onClick={() => setSelectedNote(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
