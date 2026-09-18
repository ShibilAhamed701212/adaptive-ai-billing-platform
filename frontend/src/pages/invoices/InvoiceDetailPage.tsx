import React, { useEffect, useState, useRef } from 'react';
import { apiRequest } from '../../api/client';
import { Invoice, InvoiceTemplate } from '@billing/shared';
import { InvoiceDocument } from '../../components/invoices/InvoiceDocument';
import {
  ArrowLeft,
  Printer,
  Camera,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  FileMinus,
  Palette,
  X,
  Download,
  Building2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import html2canvas from 'html2canvas';

interface InvoiceDetailPageProps {
  invoiceId: string;
  onNavigate: (path: string) => void;
}

export const InvoiceDetailPage: React.FC<InvoiceDetailPageProps> = ({ invoiceId, onNavigate }) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplate | null>(null);

  // Payment Recording Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('bank_transfer');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);

  // Credit Note Modal
  const [isCreditNoteModalOpen, setIsCreditNoteModalOpen] = useState<boolean>(false);
  const [creditNoteReason, setCreditNoteReason] = useState<string>('Dispute / Service Adjustment');
  const [creditNoteAmount, setCreditNoteAmount] = useState<number>(0);
  const [isCreatingCreditNote, setIsCreatingCreditNote] = useState<boolean>(false);

  // Screenshot capture loading state
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  const loadInvoiceAndTemplates = async () => {
    try {
      const [invRes, tplRes] = await Promise.all([
        apiRequest<Invoice>(`/invoices/${invoiceId}`),
        apiRequest<InvoiceTemplate[]>('/invoice-templates'),
      ]);

      if (invRes.success && invRes.data) {
        setInvoice(invRes.data);
        setPaymentAmount(invRes.data.amountDue || 0);
        setCreditNoteAmount(invRes.data.amountDue || 0);
      }

      if (tplRes.success && tplRes.data && tplRes.data.length > 0) {
        setTemplates(tplRes.data);
        const def = tplRes.data.find((t) => t.isDefault) || tplRes.data[0];
        setSelectedTemplate(def);
      }
    } catch (e) {
      console.error('Error loading invoice details', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoiceAndTemplates();
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

  // Capture clean PNG screenshot of invoice document
  const handleDownloadScreenshot = async () => {
    const docElement = document.getElementById('invoice-document-paper');
    if (!docElement) return;

    setIsCapturing(true);
    try {
      const canvas = await html2canvas(docElement, {
        scale: 2, // High DPI resolution
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Invoice_${invoice?.invoiceNumber || invoiceId}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to capture screenshot', err);
    } finally {
      setIsCapturing(false);
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
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      if (res.success) {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        setIsPaymentModalOpen(false);
        loadInvoiceAndTemplates();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRecording(false);
    }
  };

  const handleCreateCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || creditNoteAmount <= 0) return;

    setIsCreatingCreditNote(true);
    try {
      const res = await apiRequest('/credit-notes', {
        method: 'POST',
        body: JSON.stringify({
          originalInvoiceId: invoice._id,
          reason: creditNoteReason,
          items: [
            {
              description: `Adjustment / Rebate for ${invoice.invoiceNumber}`,
              quantity: 1,
              unitPrice: creditNoteAmount,
              taxRate: 0,
            },
          ],
          autoApply: true,
        }),
      });

      if (res.success) {
        setIsCreditNoteModalOpen(false);
        loadInvoiceAndTemplates();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingCreditNote(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Loading immutable invoice snapshot...</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Retrieving line totals, tax breakdown, and customer snapshot from MongoDB.
        </p>
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
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Notification / Isolation Banner */}
      <div className="helper-banner no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Building2 size={16} color="var(--accent-primary)" />
          <span>
            🔒 <strong>Immutable Snapshot Active:</strong> Rates, taxes, and customer addresses are permanently frozen for audit compliance.
          </span>
        </div>
        <span className="badge badge-paid">Audit Protected</span>
      </div>

      {/* Action Control Bar */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('/invoices')}>
          <ArrowLeft size={16} /> Back to Invoices
        </button>

        {/* Template Selector & Export Tools */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Live Template Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.2rem 0.6rem' }}>
            <Palette size={14} color="var(--text-muted)" />
            <select
              className="form-select"
              style={{ border: 'none', padding: '0.35rem 0.5rem', fontSize: '0.8125rem', boxShadow: 'none' }}
              value={selectedTemplate?._id || selectedTemplate?.layout.templateStyle || 'modern'}
              onChange={(e) => {
                const val = e.target.value;
                const found = templates.find((t) => t._id === val);
                if (found) {
                  setSelectedTemplate(found);
                } else {
                  // Fallback to style preset
                  setSelectedTemplate({
                    templateName: val,
                    layout: { templateStyle: val as any, showLogo: true, showGstin: true, showBankDetails: true, showHsnSac: true, showTaxBreakdown: true },
                    brandColors: { primary: '#4f46e5' },
                  });
                }
              }}
            >
              <optgroup label="Saved Templates">
                {templates.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.templateName} {t.isDefault ? '★' : ''}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Design Presets">
                <option value="modern">Modern Tech</option>
                <option value="classic">Classic Corporate</option>
                <option value="gst_master">GST Tax Master</option>
                <option value="minimalist">Minimalist</option>
                <option value="pos_thermal">POS Receipt</option>
                <option value="creative">Creative Studio</option>
              </optgroup>
            </select>
          </div>

          {/* Screenshot PNG Download */}
          <button className="btn btn-secondary btn-sm" onClick={handleDownloadScreenshot} disabled={isCapturing}>
            <Camera size={15} /> {isCapturing ? 'Generating Image...' : 'Capture Image (PNG)'}
          </button>

          {/* Print / Save PDF */}
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <Printer size={15} /> Print / Save PDF
          </button>

          {/* Status Actions */}
          {invoice.status === 'draft' && (
            <button className="btn btn-primary btn-sm" onClick={() => handleUpdateStatus('sent')}>
              <CheckCircle2 size={15} /> Mark as Sent
            </button>
          )}

          {/* Credit Note Button */}
          {invoice.amountDue > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={() => setIsCreditNoteModalOpen(true)}>
              <FileMinus size={15} /> Issue Credit Note
            </button>
          )}

          {/* Record Payment Button */}
          {invoice.amountDue > 0 && (
            <button className="btn btn-primary btn-sm" onClick={() => setIsPaymentModalOpen(true)}>
              <CreditCard size={15} /> Record Payment (₹{invoice.amountDue.toLocaleString()})
            </button>
          )}
        </div>
      </div>

      {/* Rendered Invoice Paper */}
      <InvoiceDocument invoice={invoice} template={selectedTemplate} />

      {/* Record Payment Modal */}
      {isPaymentModalOpen && (
        <div
          className="no-print"
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
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Record Invoice Payment</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsPaymentModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
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
                <span className="element-desc">Max outstanding: ₹{invoice.amountDue.toLocaleString()}</span>
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
                  <option value="cash">Cash Counter</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Transaction Reference / UTR</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. HDFC-UTR-883192"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isRecording}>
                  {isRecording ? 'Reconciling...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit Note Modal */}
      {isCreditNoteModalOpen && (
        <div
          className="no-print"
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
          <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Issue Credit Note</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsCreditNoteModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCreditNote}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Create an official credit note to reduce the outstanding balance of invoice #{invoice.invoiceNumber}.
              </p>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Adjustment Amount (₹)</label>
                <input
                  type="number"
                  className="form-input num-mono"
                  required
                  min="1"
                  max={invoice.amountDue}
                  value={creditNoteAmount}
                  onChange={(e) => setCreditNoteAmount(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Reason for Credit Adjustment</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={creditNoteReason}
                  onChange={(e) => setCreditNoteReason(e.target.value)}
                  placeholder="e.g. Service dispute, volume discount, goods return"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreditNoteModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isCreatingCreditNote}>
                  {isCreatingCreditNote ? 'Issuing...' : 'Issue & Apply Credit Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
