import React from 'react';
import { Invoice, InvoiceTemplate } from '@billing/shared';

interface InvoiceDocumentProps {
  invoice: Invoice;
  template?: InvoiceTemplate | null;
  organizationName?: string;
  organizationEmail?: string;
  organizationPhone?: string;
  organizationAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  organizationGstin?: string;
}

export const InvoiceDocument: React.FC<InvoiceDocumentProps> = ({
  invoice,
  template,
  organizationName = 'Adaptive Billing Corp',
  organizationEmail = 'billing@adaptive.io',
  organizationPhone = '+91 98765 43210',
  organizationAddress = {
    street: '100 Tech Park Avenue, Cyber City',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560103',
    country: 'India',
  },
  organizationGstin = '29AABCU9603R1ZM',
}) => {
  const layout = template?.layout || {
    showLogo: true,
    showGstin: true,
    showHsnSac: true,
    showCustomFields: true,
    showPaymentTerms: true,
    showNotes: true,
    showTaxBreakdown: true,
    showBankDetails: true,
    templateStyle: 'modern' as const,
    headerText: 'Tax Invoice',
    footerText: 'Thank you for your valued partnership!',
    bankDetails: {
      bankName: 'HDFC Bank Ltd',
      accountName: 'Adaptive Billing Solutions Pvt Ltd',
      accountNumber: '50200049281920',
      ifscCode: 'HDFC0000240',
      upiId: 'adaptivebilling@hdfcbank',
    },
  };

  const brandColors = template?.brandColors || {
    primary: '#4f46e5',
    accent: '#10b981',
    textColor: '#0f172a',
    bgColor: '#ffffff',
  };

  const style = layout.templateStyle || 'modern';
  const primaryColor = brandColors.primary || '#4f46e5';

  // Format currency
  const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // POS Thermal Receipt Layout
  if (style === 'pos_thermal') {
    return (
      <div
        id="invoice-document-paper"
        className="invoice-paper template-pos_thermal"
        style={{
          background: '#ffffff',
          color: '#111827',
          padding: '1.5rem',
          maxWidth: '380px',
          margin: '0 auto',
          border: '1px dashed #cbd5e1',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ textAlign: 'center', borderBottom: '1px dashed #94a3b8', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>{organizationName}</h2>
          <div style={{ fontSize: '0.75rem' }}>{organizationAddress.city}, {organizationAddress.state}</div>
          {organizationGstin && <div style={{ fontSize: '0.7rem' }}>GSTIN: {organizationGstin}</div>}
          <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 600 }}>TAX INVOICE / RECEIPT</div>
          <div style={{ fontSize: '0.75rem' }}>#{invoice.invoiceNumber} • {invoice.issueDate}</div>
        </div>

        <div style={{ fontSize: '0.75rem', marginBottom: '0.75rem' }}>
          <div><strong>Customer:</strong> {invoice.customerSnapshot?.name}</div>
          {invoice.customerSnapshot?.phone && <div><strong>Phone:</strong> {invoice.customerSnapshot.phone}</div>}
        </div>

        <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', marginBottom: '0.75rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px dashed #94a3b8' }}>
              <th style={{ textAlign: 'left', padding: '0.25rem 0' }}>Item</th>
              <th style={{ textAlign: 'right', padding: '0.25rem 0' }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '0.25rem 0' }}>Price</th>
              <th style={{ textAlign: 'right', padding: '0.25rem 0' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, idx) => (
              <tr key={idx}>
                <td style={{ padding: '0.25rem 0' }}>{it.description}</td>
                <td style={{ textAlign: 'right' }}>{it.quantity}</td>
                <td style={{ textAlign: 'right' }}>{it.unitPrice}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '0.5rem', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal:</span>
            <span>{fmt(invoice.subtotal)}</span>
          </div>
          {invoice.discountTotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Discount:</span>
              <span>-{fmt(invoice.discountTotal)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Taxes:</span>
            <span>{fmt(invoice.taxTotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.95rem', borderTop: '1px solid #111827', paddingTop: '0.25rem' }}>
            <span>Total:</span>
            <span>{fmt(invoice.grandTotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
            <span>Paid:</span>
            <span>{fmt(invoice.amountPaid)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>Balance Due:</span>
            <span>{fmt(invoice.amountDue)}</span>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px dashed #94a3b8', fontSize: '0.7rem' }}>
          {layout.footerText || 'Thank you for your visit!'}
        </div>
      </div>
    );
  }

  // Minimalist Template
  if (style === 'minimalist') {
    return (
      <div
        id="invoice-document-paper"
        className="invoice-paper template-minimalist"
        style={{
          background: '#ffffff',
          color: '#333333',
          padding: '3rem',
          maxWidth: '850px',
          margin: '0 auto',
          fontFamily: 'Helvetica, Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem' }}>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 300, margin: '0 0 0.5rem', color: primaryColor }}>{organizationName}</h1>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>
              {organizationAddress.street}<br/>
              {organizationAddress.city}, {organizationAddress.state} {organizationAddress.postalCode}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 300, margin: '0 0 0.5rem', letterSpacing: '0.1em' }}>INVOICE</h2>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>#{invoice.invoiceNumber}</div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>{invoice.issueDate}</div>
          </div>
        </div>

        <div style={{ marginBottom: '3rem' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#999', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Billed To</div>
          <div style={{ fontSize: '1rem', fontWeight: 400 }}>{invoice.customerSnapshot?.name}</div>
          <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
            {invoice.customerSnapshot?.billingAddress?.street}<br/>
            {invoice.customerSnapshot?.billingAddress?.city}, {invoice.customerSnapshot?.billingAddress?.state} {invoice.customerSnapshot?.billingAddress?.postalCode}
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '3rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '0.75rem 0', textAlign: 'left', fontWeight: 400, color: '#999', fontSize: '0.75rem' }}>Description</th>
              <th style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 400, color: '#999', fontSize: '0.75rem' }}>Qty</th>
              <th style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 400, color: '#999', fontSize: '0.75rem' }}>Rate</th>
              <th style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 400, color: '#999', fontSize: '0.75rem' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #f9f9f9' }}>
                <td style={{ padding: '1rem 0', fontSize: '0.85rem' }}>{it.description}</td>
                <td style={{ padding: '1rem 0', fontSize: '0.85rem', textAlign: 'right' }}>{it.quantity}</td>
                <td style={{ padding: '1rem 0', fontSize: '0.85rem', textAlign: 'right' }}>{fmt(it.unitPrice)}</td>
                <td style={{ padding: '1rem 0', fontSize: '0.85rem', textAlign: 'right' }}>{fmt(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '3rem' }}>
          <div style={{ width: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f9f9f9', fontSize: '0.85rem' }}>
              <span style={{ color: '#666' }}>Subtotal</span>
              <span>{fmt(invoice.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f9f9f9', fontSize: '0.85rem' }}>
              <span style={{ color: '#666' }}>Tax</span>
              <span>{fmt(invoice.taxTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', fontSize: '1.1rem' }}>
              <span>Total</span>
              <span>{fmt(invoice.grandTotal)}</span>
            </div>
          </div>
        </div>

        {layout.showBankDetails && layout.bankDetails && (
          <div style={{ fontSize: '0.85rem', color: '#666', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
            <strong style={{ color: '#333' }}>Payment Details:</strong><br/>
            {layout.bankDetails.bankName} - {layout.bankDetails.accountName}<br/>
            Account: {layout.bankDetails.accountNumber} | IFSC: {layout.bankDetails.ifscCode}
          </div>
        )}
      </div>
    );
  }

  // Classic Corporate Template
  if (style === 'classic') {
    return (
      <div
        id="invoice-document-paper"
        className="invoice-paper template-classic"
        style={{
          background: '#ffffff',
          color: '#1e293b',
          border: '2px solid #334155',
          borderRadius: '4px',
          padding: '2.5rem',
          maxWidth: '900px',
          margin: '0 auto',
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* Classic Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #334155', paddingBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', margin: 0, color: '#1e293b', letterSpacing: '0.05em' }}>
              {organizationName.toUpperCase()}
            </h1>
            <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: '#475569' }}>
              {organizationAddress.street}, {organizationAddress.city}, {organizationAddress.state} - {organizationAddress.postalCode}
            </p>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>
              Email: {organizationEmail} | Phone: {organizationPhone}
            </p>
            {layout.showGstin && organizationGstin && (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', fontWeight: 700 }}>
                GSTIN: {organizationGstin}
              </p>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: '1.5rem', margin: 0, color: '#334155', textTransform: 'uppercase' }}>
              {layout.headerText || 'TAX INVOICE'}
            </h2>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0.4rem 0' }}>
              #{invoice.invoiceNumber}
            </div>
            <div style={{ fontSize: '0.85rem' }}><strong>Date:</strong> {invoice.issueDate}</div>
            <div style={{ fontSize: '0.85rem' }}><strong>Due Date:</strong> {invoice.dueDate}</div>
            <div style={{ marginTop: '0.5rem' }}>
              <span className={`badge badge-${invoice.status}`}>
                {invoice.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div style={{ margin: '1.5rem 0', padding: '1rem', background: '#f8fafc', border: '1px solid #cbd5e1' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
            BILLED TO:
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.2rem' }}>
            {invoice.customerSnapshot?.name}
          </div>
          {invoice.customerSnapshot?.companyName && (
            <div style={{ fontSize: '0.9rem', color: '#475569' }}>{invoice.customerSnapshot.companyName}</div>
          )}
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>
            {invoice.customerSnapshot?.billingAddress?.street}, {invoice.customerSnapshot?.billingAddress?.city},{' '}
            {invoice.customerSnapshot?.billingAddress?.state} {invoice.customerSnapshot?.billingAddress?.postalCode}
          </div>
          {invoice.customerSnapshot?.gstinOrTaxId && (
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '0.2rem' }}>
              GSTIN/Tax ID: {invoice.customerSnapshot.gstinOrTaxId}
            </div>
          )}
        </div>

        {/* Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '1.5rem 0', border: '1px solid #334155' }}>
          <thead>
            <tr style={{ background: '#334155', color: '#ffffff' }}>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', fontSize: '0.8rem' }}>#</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', fontSize: '0.8rem' }}>Description</th>
              {layout.showHsnSac && <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontSize: '0.8rem' }}>HSN/SAC</th>}
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontSize: '0.8rem' }}>Qty</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontSize: '0.8rem' }}>Rate</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontSize: '0.8rem' }}>Tax %</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontSize: '0.8rem' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.85rem' }}>{idx + 1}</td>
                <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.85rem', fontWeight: 600 }}>{it.description}</td>
                {layout.showHsnSac && <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.85rem', textAlign: 'center' }}>{it.hsnSacCode || '-'}</td>}
                <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.85rem', textAlign: 'right' }}>{it.quantity} {it.unit}</td>
                <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.85rem', textAlign: 'right' }}>{fmt(it.unitPrice)}</td>
                <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.85rem', textAlign: 'right' }}>{it.taxRate * 100}%</td>
                <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.85rem', textAlign: 'right', fontWeight: 700 }}>{fmt(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals & Bank Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', marginTop: '1.5rem' }}>
          <div>
            {layout.showBankDetails && layout.bankDetails && (
              <div style={{ border: '1px solid #cbd5e1', padding: '0.85rem', background: '#f8fafc', fontSize: '0.8rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.3rem', textTransform: 'uppercase' }}>Bank Remittance Details</div>
                <div><strong>Bank Name:</strong> {layout.bankDetails.bankName}</div>
                <div><strong>Account Name:</strong> {layout.bankDetails.accountName}</div>
                <div><strong>Account No:</strong> {layout.bankDetails.accountNumber}</div>
                <div><strong>IFSC Code:</strong> {layout.bankDetails.ifscCode}</div>
                {layout.bankDetails.upiId && <div><strong>UPI ID:</strong> {layout.bankDetails.upiId}</div>}
              </div>
            )}
            {layout.showPaymentTerms && invoice.terms && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#475569' }}>
                <strong>Terms:</strong> {invoice.terms}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal:</span>
              <span>{fmt(invoice.subtotal)}</span>
            </div>
            {invoice.discountTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b45309' }}>
                <span>Discount:</span>
                <span>-{fmt(invoice.discountTotal)}</span>
              </div>
            )}
            {invoice.taxBreakdown?.map((tax, tIdx) => (
              <div key={tIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                <span>{tax.taxType} ({tax.rate * 100}%):</span>
                <span>{fmt(tax.taxAmount)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.15rem', borderTop: '2px solid #334155', paddingTop: '0.5rem' }}>
              <span>Grand Total:</span>
              <span>{fmt(invoice.grandTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 600 }}>
              <span>Amount Paid:</span>
              <span>{fmt(invoice.amountPaid)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem', color: invoice.amountDue > 0 ? '#e11d48' : '#16a34a' }}>
              <span>Balance Due:</span>
              <span>{fmt(invoice.amountDue)}</span>
            </div>
          </div>
        </div>

        {layout.footerText && (
          <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.8rem', color: '#64748b', borderTop: '1px solid #cbd5e1', paddingTop: '0.75rem' }}>
            {layout.footerText}
          </div>
        )}
      </div>
    );
  }

  // Modern / GST Master / Minimalist Layout
  return (
    <div
      id="invoice-document-paper"
      className={`invoice-paper template-${style}`}
      style={{
        background: '#ffffff',
        color: '#0f172a',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '3rem',
        maxWidth: style === 'gst_master' ? '980px' : '900px',
        margin: '0 auto',
        boxShadow: '0 4px 25px rgba(0, 0, 0, 0.05)',
        fontFamily: template?.fontFamily || 'Inter, -apple-system, sans-serif',
      }}
    >
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2px solid ${primaryColor}`, paddingBottom: '1.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            {layout.showLogo && (
              <div
                style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '8px',
                  background: primaryColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '1.25rem',
                }}
              >
                A
              </div>
            )}
            <div>
              <h1 style={{ fontSize: '1.4rem', margin: 0, color: '#0f172a', fontWeight: 800 }}>
                {organizationName}
              </h1>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                {organizationAddress.street}, {organizationAddress.city}, {organizationAddress.state} {organizationAddress.postalCode}
              </p>
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
            <span><strong>Email:</strong> {organizationEmail}</span>
            <span><strong>Phone:</strong> {organizationPhone}</span>
          </div>
          {layout.showGstin && organizationGstin && (
            <div style={{ fontSize: '0.75rem', color: primaryColor, fontWeight: 700, marginTop: '0.25rem' }}>
              GSTIN: {organizationGstin}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: '1.2rem',
              fontWeight: 800,
              color: primaryColor,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {layout.headerText || (style === 'gst_master' ? 'GST TAX INVOICE' : 'TAX INVOICE')}
          </div>
          <div className="num-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
            #{invoice.invoiceNumber}
          </div>
          <span className={`badge badge-${invoice.status}`} style={{ fontSize: '0.75rem' }}>
            {invoice.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Billed To & Invoice Metadata Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '2rem', margin: '2rem 0' }}>
        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
            BILLED TO:
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
            {invoice.customerSnapshot?.name}
          </div>
          {invoice.customerSnapshot?.companyName && (
            <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
              {invoice.customerSnapshot.companyName}
            </div>
          )}
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem', lineHeight: 1.4 }}>
            {invoice.customerSnapshot?.billingAddress?.street ? `${invoice.customerSnapshot.billingAddress.street}, ` : ''}
            {invoice.customerSnapshot?.billingAddress?.city ? `${invoice.customerSnapshot.billingAddress.city}, ` : ''}
            {invoice.customerSnapshot?.billingAddress?.state} {invoice.customerSnapshot?.billingAddress?.postalCode || ''}
          </div>
          {invoice.customerSnapshot?.gstinOrTaxId && (
            <div style={{ fontSize: '0.8rem', color: primaryColor, fontWeight: 700, marginTop: '0.35rem' }}>
              GSTIN / PAN: {invoice.customerSnapshot.gstinOrTaxId}
            </div>
          )}
        </div>

        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: '#64748b' }}>Issue Date:</span>
            <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{invoice.issueDate}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: '#64748b' }}>Payment Due Date:</span>
            <span style={{ fontWeight: 600, fontFamily: 'monospace', color: '#e11d48' }}>{invoice.dueDate}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: '#64748b' }}>Place of Supply:</span>
            <span style={{ fontWeight: 600 }}>{invoice.customerSnapshot?.billingAddress?.state || 'Local State'}</span>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div style={{ overflowX: 'auto', margin: '2rem 0', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>#</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Item Description</th>
              {layout.showHsnSac && (
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>HSN/SAC</th>
              )}
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Qty</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Rate</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Disc</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Tax %</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{idx + 1}</td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{it.description}</div>
                  {it.sku && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>SKU: {it.sku}</div>}
                </td>
                {layout.showHsnSac && (
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {it.hsnSacCode || '-'}
                  </td>
                )}
                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace' }}>
                  {it.quantity} {it.unit}
                </td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace' }}>
                  {fmt(it.unitPrice)}
                </td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', color: '#d97706' }}>
                  {it.discountAmount > 0 ? `-${fmt(it.discountAmount)}` : '-'}
                </td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace' }}>
                  {it.taxRate * 100}%
                </td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                  {fmt(it.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals & Tax Matrix */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', marginTop: '1.5rem' }}>
        <div>
          {layout.showBankDetails && layout.bankDetails && (
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: primaryColor, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Bank Payment Remittance
              </div>
              <div style={{ fontSize: '0.8rem', color: '#334155', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                <div><strong>Bank:</strong> {layout.bankDetails.bankName}</div>
                <div><strong>A/C No:</strong> {layout.bankDetails.accountNumber}</div>
                <div><strong>IFSC:</strong> {layout.bankDetails.ifscCode}</div>
                {layout.bankDetails.upiId && <div><strong>UPI ID:</strong> {layout.bankDetails.upiId}</div>}
              </div>
            </div>
          )}

          {layout.showCustomFields && invoice.customFields && Object.keys(invoice.customFields).length > 0 && (
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Additional Details:
              </div>
              {Object.entries(invoice.customFields).map(([k, v]) => (
                <div key={k} style={{ fontSize: '0.75rem', color: '#475569' }}>
                  <strong>{k}:</strong> {String(v)}
                </div>
              ))}
            </div>
          )}

          {layout.showNotes && invoice.notes && (
            <div style={{ fontSize: '0.8rem', color: '#475569', fontStyle: 'italic', marginTop: '0.5rem' }}>
              <strong>Note:</strong> {invoice.notes}
            </div>
          )}
          {layout.showPaymentTerms && invoice.terms && (
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
              <strong>Terms:</strong> {invoice.terms}
            </div>
          )}
        </div>

        {/* Calculation Totals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
            <span>Subtotal:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmt(invoice.subtotal)}</span>
          </div>
          {invoice.discountTotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d97706' }}>
              <span>Total Discount:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>-{fmt(invoice.discountTotal)}</span>
            </div>
          )}
          {layout.showTaxBreakdown &&
            invoice.taxBreakdown?.map((tax, tIdx) => (
              <div key={tIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                <span>{tax.taxType} ({tax.rate * 100}%):</span>
                <span style={{ fontFamily: 'monospace' }}>{fmt(tax.taxAmount)}</span>
              </div>
            ))}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 800,
              fontSize: '1.25rem',
              paddingTop: '0.75rem',
              borderTop: `2px solid ${primaryColor}`,
              color: '#0f172a',
            }}
          >
            <span>Grand Total:</span>
            <span style={{ color: primaryColor, fontFamily: 'monospace' }}>{fmt(invoice.grandTotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 600 }}>
            <span>Amount Paid:</span>
            <span style={{ fontFamily: 'monospace' }}>{fmt(invoice.amountPaid)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 800,
              fontSize: '1.1rem',
              color: invoice.amountDue > 0 ? '#e11d48' : '#16a34a',
            }}
          >
            <span>Balance Due:</span>
            <span style={{ fontFamily: 'monospace' }}>{fmt(invoice.amountDue)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      {layout.footerText && (
        <div
          style={{
            marginTop: '2.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e2e8f0',
            textAlign: 'center',
            fontSize: '0.8rem',
            color: '#64748b',
          }}
        >
          {layout.footerText}
        </div>
      )}
    </div>
  );
};
