import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { Invoice } from '@billing/shared';
import {
  ArrowLeft,
  Printer,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Building2,
  Calendar,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface InvoiceDetailPageProps {
  invoiceId: string;
  onNavigate: (path: string) => void;
}

export const InvoiceDetailPage: React.FC<InvoiceDetailPageProps> = ({ invoiceId, onNavigate }) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('bank_transfer');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);

  const loadInvoice = async () => {
    try {
      const res = await apiRequest<Invoice>(`/invoices/${invoiceId}`);
      if (res.success && res.data) {
        setInvoice(res.data);
        setPaymentAmount(res.data.amountDue || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const res = await apiRequest(`/invoices/${invoiceId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.success && res.data) {
        setInvoice(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || paymentAmount <= 0) return;

    setIsRecording(true);
    try {
      const res = await apiRequest('/payments', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: invoice._id,
          amount: paymentAmount,
          paymentMethod,
          transactionReference: paymentRef,
        }),
      });

      if (res.success) {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        setIsPaymentModalOpen(false);
        loadInvoice();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRecording(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Loading immutable invoice snapshot...</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Retrieving line totals, tax breakdown, and customer snapshot from MongoDB.</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '3.5rem 2rem', maxWidth: '500px', margin: '3rem auto' }}>
        <AlertTriangle size={36} color="var(--color-warning)" style={{ marginBottom: '1rem' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Invoice Not Found</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          The requested invoice record does not exist or belongs to another tenant organization.
        </p>
        <button className="btn btn-primary" onClick={() => onNavigate('/invoices')}>
          <ArrowLeft size={16} /> Return to Invoicing Studio
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Informational Banner */}
      <div
        style={{
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.8rem',
          color: '#c7d2fe',
        }}
      >
        <span>
          🔒 <strong>Immutable Snapshot Active:</strong> Line items, taxes, and customer addresses are permanently captured at invoice generation to prevent historical drift.
        </span>
        <span className="badge badge-paid">Audit Protected</span>
      </div>
      {/* Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('/invoices')}>
          <ArrowLeft size={16} /> Back to Invoices
        </button>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={() => window.print()}>
            <Printer size={16} /> Print / Save PDF
          </button>

          {invoice.status === 'draft' && (
            <button className="btn btn-primary" onClick={() => handleUpdateStatus('sent')}>
              <CheckCircle2 size={16} /> Mark as Sent
            </button>
          )}

          {invoice.amountDue > 0 && (
            <button className="btn btn-success" onClick={() => setIsPaymentModalOpen(true)}>
              <CreditCard size={16} /> Record Payment (₹{invoice.amountDue.toLocaleString()})
            </button>
          )}
        </div>
      </div>

      {/* Invoice Document Paper */}
      <div
        className="glass-panel"
        style={{
          padding: '3rem',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Document Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div
                style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '6px',
                  background: 'var(--accent-gradient)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                }}
              >
                A
              </div>
              <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Tax Invoicing</h2>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              Original for Recipient • GST Compliant
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span className={`badge badge-${invoice.status}`} style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              {invoice.status.replace('_', ' ')}
            </span>
            <div className="num-mono" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
              {invoice.invoiceNumber}
            </div>
          </div>
        </div>

        {/* Billed To & Dates Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem', margin: '2rem 0' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              BILLED TO:
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {invoice.customerSnapshot?.name}
            </div>
            {invoice.customerSnapshot?.companyName && (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {invoice.customerSnapshot.companyName}
              </div>
            )}
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              {invoice.customerSnapshot?.billingAddress?.street}, {invoice.customerSnapshot?.billingAddress?.city},{' '}
              {invoice.customerSnapshot?.billingAddress?.state} {invoice.customerSnapshot?.billingAddress?.postalCode}
            </div>
            {invoice.customerSnapshot?.gstinOrTaxId && (
              <div style={{ fontSize: '0.8rem', color: '#c7d2fe', marginTop: '0.3rem' }}>
                <strong>GSTIN:</strong> {invoice.customerSnapshot.gstinOrTaxId}
              </div>
            )}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Issue Date:</span>
              <span className="num-mono" style={{ fontWeight: 600 }}>{invoice.issueDate}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Due Date:</span>
              <span className="num-mono" style={{ fontWeight: 600 }}>{invoice.dueDate}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Currency:</span>
              <span className="num-mono" style={{ fontWeight: 600 }}>{invoice.currency} ({invoice.currencySymbol})</span>
            </div>
          </div>
        </div>

        {/* Snapshot Items Table */}
        <div className="data-table-container" style={{ margin: '2rem 0' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item Description</th>
                <th>HSN/SAC</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Discount</th>
                <th>Tax %</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.description}</div>
                    {item.sku && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SKU: {item.sku}</div>}
                  </td>
                  <td className="num-mono" style={{ fontSize: '0.8rem' }}>{item.hsnSacCode || '-'}</td>
                  <td className="num-mono">{item.quantity} {item.unit}</td>
                  <td className="num-mono">₹{item.unitPrice.toLocaleString()}</td>
                  <td className="num-mono" style={{ color: 'var(--color-warning)' }}>
                    {item.discountAmount > 0 ? `-₹${item.discountAmount.toLocaleString()}` : '-'}
                  </td>
                  <td className="num-mono">{item.taxRate * 100}%</td>
                  <td className="num-mono" style={{ fontWeight: 700 }}>₹{item.lineTotal.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & Tax Summary Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', marginTop: '2rem' }}>
          <div>
            {/* Custom fields tag block */}
            {invoice.customFields && Object.keys(invoice.customFields).length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Custom Model Metadata:
                </div>
                {Object.entries(invoice.customFields).map(([k, v]) => (
                  <div key={k} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    <strong>{k}:</strong> {String(v)}
                  </div>
                ))}
              </div>
            )}

            {invoice.notes && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                Notes: {invoice.notes}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
              <span className="num-mono">₹{invoice.subtotal.toLocaleString()}</span>
            </div>
            {invoice.discountTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-warning)' }}>
                <span>Total Discount:</span>
                <span className="num-mono">-₹{invoice.discountTotal.toLocaleString()}</span>
              </div>
            )}
            {invoice.taxBreakdown?.map((tax, tIdx) => (
              <div key={tIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>{tax.taxType} ({tax.rate * 100}%):</span>
                <span className="num-mono">₹{tax.taxAmount.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.2rem', paddingTop: '0.75rem', borderTop: '2px solid var(--border-subtle)' }}>
              <span>Grand Total:</span>
              <span className="num-mono" style={{ color: 'var(--accent-secondary)' }}>₹{invoice.grandTotal.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)', fontWeight: 600 }}>
              <span>Amount Paid:</span>
              <span className="num-mono">₹{invoice.amountPaid.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: invoice.amountDue > 0 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 700, fontSize: '1.1rem' }}>
              <span>Balance Due:</span>
              <span className="num-mono">₹{invoice.amountDue.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {isPaymentModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Record Payment</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsPaymentModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="form-group">
                <label className="form-label">Payment Amount (₹)</label>
                <input
                  type="number"
                  className="form-input num-mono"
                  required
                  min="1"
                  max={invoice.amountDue}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select
                  className="form-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                  <option value="upi">UPI / Instant Pay</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="cash">Cash Counter</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Transaction Reference / UTR</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. HDFC-UTR-883192"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" disabled={isRecording}>
                  {isRecording ? 'Reconciling...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
