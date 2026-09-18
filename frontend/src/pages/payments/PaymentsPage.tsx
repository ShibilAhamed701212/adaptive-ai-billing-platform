import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { Payment, Invoice } from '@billing/shared';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  RotateCcw,
  Download,
  Building,
  CheckCircle,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PaymentsPageProps {
  onNavigate?: (path: string) => void;
}

export const PaymentsPage: React.FC<PaymentsPageProps> = ({ onNavigate }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');

  // Record Payment Modal
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('bank_transfer');
  const [refNumber, setRefNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Refund Modal
  const [isRefundModalOpen, setIsRefundModalOpen] = useState<boolean>(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState<string>('Customer Request');
  const [isRefunding, setIsRefunding] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const [payRes, invRes] = await Promise.all([
        apiRequest<Payment[]>('/payments'),
        apiRequest<Invoice[]>('/invoices'),
      ]);

      if (payRes.success && payRes.data) {
        setPayments(payRes.data);
      }
      if (invRes.success && invRes.data) {
        setInvoices(invRes.data);
      }
    } catch (e) {
      console.error('Error loading payments', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId || amount <= 0) return;

    setIsSubmitting(true);
    try {
      const res = await apiRequest('/payments', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: selectedInvoiceId,
          amount,
          paymentMethod,
          transactionReference: refNumber,
          notes,
        }),
      });

      if (res.success) {
        confetti({ particleCount: 100, spread: 70 });
        setIsRecordModalOpen(false);
        setSelectedInvoiceId('');
        setAmount(0);
        setRefNumber('');
        setNotes('');
        loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment || refundAmount <= 0) return;

    setIsRefunding(true);
    try {
      const res = await apiRequest(`/payments/${selectedPayment._id}/refund`, {
        method: 'POST',
        body: JSON.stringify({
          amount: refundAmount,
          reason: refundReason,
        }),
      });

      if (res.success) {
        setIsRefundModalOpen(false);
        setSelectedPayment(null);
        loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefunding(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Payment Date', 'Invoice ID', 'Method', 'Transaction Ref', 'Amount (INR)', 'Status'];
    const rows = filteredPayments.map((p) => [
      p.paymentDate,
      p.invoiceId,
      p.paymentMethod,
      p.transactionReference || 'N/A',
      p.amount,
      p.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Payments_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredPayments = payments.filter((p) => {
    const matchesMethod = selectedMethod === 'ALL' || p.paymentMethod === selectedMethod;
    const matchesSearch =
      !searchTerm ||
      (p.transactionReference && p.transactionReference.toLowerCase().includes(searchTerm.toLowerCase())) ||
      p.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesMethod && matchesSearch;
  });

  const totalCollected = payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalRefunded = payments.filter((p) => p.status === 'refunded').reduce((sum, p) => sum + (p.amount || 0), 0);

  // Unpaid or partially paid invoices eligible for payment
  const openInvoices = invoices.filter((i) => i.amountDue > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Payments & AR Ledger</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
            Real-time accounts receivable reconciliation, instant payments & refund processing
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={15} /> Export Ledger CSV
          </button>
          <button className="btn btn-primary" onClick={() => setIsRecordModalOpen(true)}>
            <Plus size={15} /> Record Payment
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Collected</span>
            <CheckCircle size={18} color="var(--color-success)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-success)' }}>
            ₹{totalCollected.toLocaleString()}
          </div>
          <div className="kpi-desc">Total confirmed inflow</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Refunded</span>
            <RotateCcw size={18} color="var(--color-warning)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>
            ₹{totalRefunded.toLocaleString()}
          </div>
          <div className="kpi-desc">Disputes & adjustments</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Recorded Transactions</span>
            <CreditCard size={18} color="var(--accent-primary)" />
          </div>
          <div className="kpi-value">{payments.length}</div>
          <div className="kpi-desc">Across all payment rails</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Open Invoices Due</span>
            <ArrowUpRight size={18} color="var(--color-danger)" />
          </div>
          <div className="kpi-value">{openInvoices.length}</div>
          <div className="kpi-desc">Awaiting settlement</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '240px', background: '#f8fafc', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by transaction reference, UTR, method..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.85rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={15} color="var(--text-muted)" />
          <select
            className="form-select"
            style={{ width: 'auto', fontSize: '0.8125rem' }}
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
          >
            <option value="ALL">All Payment Methods</option>
            <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
            <option value="upi">UPI / Instant Pay</option>
            <option value="credit_card">Credit Card</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>
      </div>

      {/* Payment Ledger Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Transaction Ref / UTR</th>
              <th>Method</th>
              <th>Invoice ID</th>
              <th>Amount</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Loading payment ledger...
                </td>
              </tr>
            ) : filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No payment records found matching criteria.
                </td>
              </tr>
            ) : (
              filteredPayments.map((pay) => (
                <tr key={pay._id}>
                  <td className="num-mono" style={{ fontSize: '0.8rem' }}>{pay.paymentDate}</td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {pay.transactionReference || `TXN-${String(pay._id).substring(18)}`}
                    </div>
                    {pay.notes && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{pay.notes}</div>}
                  </td>
                  <td>
                    <span className="badge badge-draft" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                      {pay.paymentMethod.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    {onNavigate ? (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: 0, color: 'var(--accent-primary)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
                        onClick={() => onNavigate(`/invoices/${pay.invoiceId}`)}
                      >
                        #{String(pay.invoiceId).substring(18)}
                      </button>
                    ) : (
                      <span className="num-mono" style={{ fontSize: '0.8rem' }}>#{String(pay.invoiceId).substring(18)}</span>
                    )}
                  </td>
                  <td className="num-mono" style={{ fontWeight: 700, fontSize: '0.9rem', color: pay.status === 'refunded' ? 'var(--color-warning)' : 'var(--color-success)' }}>
                    ₹{pay.amount.toLocaleString()}
                  </td>
                  <td>
                    <span className={`badge badge-${pay.status === 'completed' ? 'paid' : 'draft'}`}>
                      {pay.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {pay.status !== 'refunded' && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setSelectedPayment(pay);
                          setRefundAmount(pay.amount);
                          setIsRefundModalOpen(true);
                        }}
                      >
                        <RotateCcw size={13} /> Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Record Payment Modal */}
      {isRecordModalOpen && (
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
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Record Incoming Payment</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsRecordModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Target Invoice *</label>
                <select
                  className="form-select"
                  required
                  value={selectedInvoiceId}
                  onChange={(e) => {
                    setSelectedInvoiceId(e.target.value);
                    const inv = invoices.find((i) => i._id === e.target.value);
                    if (inv) setAmount(inv.amountDue);
                  }}
                >
                  <option value="">-- Select Open Invoice --</option>
                  {openInvoices.map((inv) => (
                    <option key={inv._id} value={inv._id}>
                      #{inv.invoiceNumber} - {inv.customerSnapshot?.name} (Due: ₹{inv.amountDue.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Payment Amount (₹) *</label>
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
                <label className="form-label">Payment Method</label>
                <select
                  className="form-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="upi">UPI / Instant Pay</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Transaction Reference / UTR</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. HDFC-UTR-991203"
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Notes & Comments</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Cleared via client direct portal"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsRecordModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {isRefundModalOpen && selectedPayment && (
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
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Refund Payment</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsRefundModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRefund}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Refund Amount (₹)</label>
                <input
                  type="number"
                  className="form-input num-mono"
                  required
                  min="1"
                  max={selectedPayment.amount}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                />
                <span className="element-desc">Original amount: ₹{selectedPayment.amount.toLocaleString()}</span>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Reason for Refund</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Overpayment, cancellation, dispute"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsRefundModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isRefunding}>
                  {isRefunding ? 'Refunding...' : 'Confirm Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
