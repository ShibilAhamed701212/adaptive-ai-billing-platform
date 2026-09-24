import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { Customer, Product, InvoiceCopilotDraft } from '@billing/shared';
import { DynamicFieldRenderer } from '../../components/dynamic-forms/DynamicFieldRenderer';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Calculator,
  CheckCircle2,
  Sparkles,
  Info,
} from 'lucide-react';

interface CreateInvoicePageProps {
  onNavigate: (path: string) => void;
  copilotDraft?: InvoiceCopilotDraft | null;
}

export const CreateInvoicePage: React.FC<CreateInvoicePageProps> = ({
  onNavigate,
  copilotDraft,
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [items, setItems] = useState<
    {
      productId?: string;
      description: string;
      unit: string;
      quantity: number;
      unitPrice: number;
      discountAmount: number;
      taxRate: number;
      hsnSacCode?: string;
    }[]
  >([
    {
      description: '',
      unit: 'unit',
      quantity: 1,
      unitPrice: 0,
      discountAmount: 0,
      taxRate: 0.18,
    },
  ]);
  const [invoiceDiscountAmount, setInvoiceDiscountAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('Thank you for your business!');
  const [terms, setTerms] = useState<string>('Payment due within 30 days of invoice date.');
  const [customFields, setCustomFields] = useState<Record<string, any>>({});

  // Calculation & Validation State
  const [calculationPreview, setCalculationPreview] = useState<any>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>('Modern Corporate Invoice');

  // Load initial dropdown dependencies
  useEffect(() => {
    async function loadData() {
      try {
        const [cRes, pRes, tRes] = await Promise.all([
          apiRequest<Customer[]>('/customers'),
          apiRequest<Product[]>('/products'),
          apiRequest<any[]>('/invoice-templates'),
        ]);
        if (cRes.success && cRes.data) setCustomers(cRes.data);
        if (pRes.success && pRes.data) setProducts(pRes.data);
        if (tRes.success && tRes.data && tRes.data.length > 0) {
          setTemplates(tRes.data);
          const def = tRes.data.find((t) => t.isDefault) || tRes.data[0];
          setSelectedTemplateName(def.templateName);
        }
      } catch (e) {
        console.error('Failed to load customers/products/templates', e);
      }
    }
    loadData();
  }, []);


  // Handle Copilot Prefill
  useEffect(() => {
    if (copilotDraft) {
      if (copilotDraft.customerId) {
        setSelectedCustomerId(copilotDraft.customerId);
      }
      if (copilotDraft.dueDateOffsetDays) {
        setDueDate(
          new Date(Date.now() + copilotDraft.dueDateOffsetDays * 86400000)
            .toISOString()
            .split('T')[0]
        );
      }
      if (copilotDraft.items && copilotDraft.items.length > 0) {
        setItems(
          copilotDraft.items.map((i) => ({
            productId: i.productId,
            description: i.productName,
            unit: i.unit || 'unit',
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discountAmount: 0,
            taxRate: i.taxRate !== undefined ? i.taxRate : 0.18,
          }))
        );
      }
    }
  }, [copilotDraft]);

  // Recalculate preview deterministically on change
  useEffect(() => {
    async function triggerPreview() {
      const validItems = items.filter(i => i.description.trim().length > 0 && i.quantity > 0 && i.unitPrice >= 0);
      if (validItems.length === 0) {
        setCalculationPreview(null);
        return;
      }
      try {
        const res = await apiRequest('/invoices/preview', {
          method: 'POST',
          body: JSON.stringify({
            customerId: selectedCustomerId || undefined,
            items: validItems,
            invoiceDiscountAmount,
            customFields,
          }),
        });
        if (res.success && res.data) {
          setCalculationPreview(res.data);
        }
      } catch (e) {
        console.error(e);
      }
    }
    const timer = setTimeout(triggerPreview, 250);
    return () => clearTimeout(timer);
  }, [selectedCustomerId, items, invoiceDiscountAmount, customFields]);

  const handleProductSelect = (index: number, productId: string) => {
    const prod = products.find((p) => p._id === productId);
    if (!prod) return;

    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        productId: prod._id,
        description: prod.name,
        unit: prod.unit || 'unit',
        unitPrice: prod.unitPrice,
        taxRate: prod.taxRate,
        hsnSacCode: prod.hsnSacCode,
        discountAmount: 0,
      };
      return updated;
    });
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        description: '',
        unit: 'unit',
        quantity: 1,
        unitPrice: 0,
        discountAmount: 0,
        taxRate: 0.18,
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (targetStatus: 'draft' | 'sent') => {
    if (!selectedCustomerId) {
      setError('Please select a customer account');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await apiRequest<any>('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          customerId: selectedCustomerId,
          issueDate,
          dueDate,
          items,
          invoiceDiscountAmount,
          notes,
          terms,
          customFields,
          status: targetStatus,
        }),
      });

      if (res.success && res.data) {
        onNavigate(`/invoices/${res.data._id}`);
      } else {
        setError(res.error?.message || 'Failed to generate invoice');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save invoice');
    } finally {
      setIsSaving(false);
    }
  };

  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrProcessing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/v1/ai/ocr/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('billing_auth_token')}`
        },
        body: formData
      });
      
      const data = await res.json();
      if (data.success && data.data) {
        // Populate fields
        if (data.data.items && data.data.items.length > 0) {
          setItems(data.data.items.map((it: any) => ({
            description: it.description || '',
            unit: 'unit',
            quantity: it.quantity || 1,
            unitPrice: it.unitPrice || 0,
            discountAmount: 0,
            taxRate: it.taxRate || 0,
          })));
        }
      } else {
        setError(data.error?.message || 'OCR parsing failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process OCR document');
    } finally {
      setIsOcrProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const selectedCustomer = customers.find((c) => c._id === selectedCustomerId);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('/invoices')}>
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Create New Invoice</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', margin: 0 }}>
              Deterministic pricing calculations with real-time tax breakdown
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input 
            type="file" 
            accept="image/*,application/pdf" 
            ref={fileInputRef} 
            onChange={handleOcrUpload} 
            style={{ display: 'none' }} 
          />
          <button 
            className="btn btn-secondary" 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isOcrProcessing || isSaving}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}
          >
            {isOcrProcessing ? 'Scanning...' : <><Sparkles size={16} /> Scan Bill</>}
          </button>
          <button className="btn btn-secondary" onClick={() => handleSubmit('draft')} disabled={isSaving}>
            Save as Draft
          </button>
          <button className="btn btn-primary" onClick={() => handleSubmit('sent')} disabled={isSaving}>
            <CheckCircle2 size={16} /> Finalize & Issue Invoice
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: 'var(--color-danger-bg)',
            border: '1px solid #fecdd3',
            color: 'var(--color-danger)',
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {/* Main Studio Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '1.5rem' }}>
        {/* Left Column: Form Builder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Customer & Date Selection */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)' }}>1. Customer & Billing Period</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sets destination tax jurisdiction</span>
            </div>
            <p className="section-lead">
              Select the client account. The system automatically inspects their state and GSTIN to calculate appropriate CGST/SGST (intra-state) or IGST (inter-state) tax rates.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Client Account *</label>
                <select
                  className="form-select"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} {c.companyName ? `(${c.companyName})` : ''} - {c.billingAddress?.state || 'India'}
                    </option>
                  ))}
                </select>
                <span className="element-desc">Auto-determines intra-state vs inter-state GST rules</span>
              </div>

              <div className="form-group">
                <label className="form-label">Issue Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
                <span className="element-desc">Official billing issuance date</span>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Due Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
                <span className="element-desc">Payment deadline before overdue status triggers</span>
              </div>

              <div className="form-group">
                <label className="form-label">Invoice Template Layout</label>
                <select
                  className="form-select"
                  value={selectedTemplateName}
                  onChange={(e) => setSelectedTemplateName(e.target.value)}
                >
                  <optgroup label="Saved Templates">
                    {templates.map((t) => (
                      <option key={t._id} value={t.templateName}>
                        {t.templateName} {t.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Default Layout Styles">
                    <option value="Modern Tech">Modern Tech</option>
                    <option value="Classic Corporate">Classic Corporate</option>
                    <option value="GST Tax Master">GST Tax Master</option>
                    <option value="Minimalist Slate">Minimalist Slate</option>
                    <option value="POS Retail Receipt">POS Retail Receipt</option>
                  </optgroup>
                </select>
                <span className="element-desc">Template layout for customer PDF/print view</span>
              </div>
            </div>

            {selectedCustomer && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1rem',
                  background: '#f8fafc',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  border: '1px solid var(--border-subtle)',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <strong>GSTIN/Tax ID:</strong> {selectedCustomer.gstinOrTaxId || 'Unregistered'} •{' '}
                  <strong>State:</strong> {selectedCustomer.billingAddress?.state || 'N/A'}
                </div>
                <div>
                  <strong>Current Outstanding:</strong>{' '}
                  <span style={{ fontWeight: 700, color: 'var(--color-warning)', fontFamily: 'var(--font-mono)' }}>
                    ₹{selectedCustomer.outstandingBalance.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>2. Line Items & Deterministic Rates</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addItemRow}>
                <Plus size={14} /> Add Line Item
              </button>
            </div>
            <p className="section-lead">
              Add items from your catalog or enter custom line items. Rates and taxes are computed deterministically per line item with snapshotting protection.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto',
                    gap: '0.75rem',
                    alignItems: 'start',
                  }}
                >
                  {/* Catalog or Custom Desc */}
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Item / SKU</label>
                    <select
                      className="form-select"
                      style={{ marginBottom: '0.35rem', fontSize: '0.8125rem' }}
                      value={item.productId || ''}
                      onChange={(e) => handleProductSelect(idx, e.target.value)}
                    >
                      <option value="">-- Custom Line Description --</option>
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} (₹{p.unitPrice})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.8125rem' }}
                      placeholder="Line description..."
                      value={item.description}
                      onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                    />
                    <span className="element-desc">Catalog item or custom description</span>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Qty / Unit</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0.01"
                      step="any"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 1)}
                    />
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.75rem', marginTop: '0.35rem' }}
                      placeholder="unit, hrs, seat"
                      value={item.unit}
                      onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                    />
                    <span className="element-desc">Billing count</span>
                  </div>

                  {/* Unit Price */}
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Rate (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                    />
                    <span className="element-desc">Base rate / tier price</span>
                  </div>

                  {/* Line Discount */}
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Discount (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={item.discountAmount}
                      onChange={(e) => handleItemChange(idx, 'discountAmount', parseFloat(e.target.value) || 0)}
                    />
                    <span className="element-desc">Direct line deduction</span>
                  </div>

                  {/* Tax Rate */}
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Tax %</label>
                    <select
                      className="form-select"
                      value={item.taxRate}
                      onChange={(e) => handleItemChange(idx, 'taxRate', parseFloat(e.target.value))}
                    >
                      <option value="0">0% (Exempt)</option>
                      <option value="0.05">5% GST</option>
                      <option value="0.12">12% GST</option>
                      <option value="0.18">18% GST</option>
                      <option value="0.28">28% GST</option>
                    </select>
                    <span className="element-desc">GST / VAT slab</span>
                  </div>

                  {/* Delete row */}
                  <div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-danger)', marginTop: '1.35rem' }}
                      onClick={() => removeItemRow(idx)}
                      disabled={items.length === 1}
                      title="Remove row"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Dynamic Metadata Fields for Invoice */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
              <DynamicFieldRenderer
                targetEntity="invoice"
                values={customFields}
                onChange={(key, val) => setCustomFields((prev) => ({ ...prev, [key]: val }))}
              />
            </div>
          </div>

          {/* Notes & Terms */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.25rem' }}>3. Terms & Client Communication</h3>
            <p className="section-lead">Printed on the bottom of the official tax invoice.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Client Notes & Instructions</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <span className="element-desc">Delivery details or cordial thank-you message</span>
              </div>
              <div className="form-group">
                <label className="form-label">Terms & Conditions</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                />
                <span className="element-desc">Payment schedule and legal contract clauses</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Deterministic Calculation Summary */}
        <div>
          <div
            className="glass-panel"
            style={{
              padding: '1.5rem',
              position: 'sticky',
              top: '5.5rem',
              border: '1px solid #c7d2fe',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Calculator size={18} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Calculation Breakdown</h3>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Deterministic financial totals computed on server
            </p>

            {/* Subtotals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Items Subtotal:</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  ₹{(calculationPreview?.totals?.rawSubtotal || 0).toLocaleString()}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Item Discounts:</span>
                <span style={{ color: 'var(--color-warning)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  -₹{(calculationPreview?.totals?.itemDiscountTotal || 0).toLocaleString()}
                </span>
              </div>

              <div className="form-group" style={{ margin: '0.5rem 0' }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Invoice-Level Discount (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  value={invoiceDiscountAmount}
                  onChange={(e) => setInvoiceDiscountAmount(parseFloat(e.target.value) || 0)}
                />
                <span className="element-desc">Lump-sum discount subtracted from taxable base</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Taxable Value:</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  ₹{(calculationPreview?.totals?.taxableAmount || 0).toLocaleString()}
                </span>
              </div>

              {/* Tax Breakdowns */}
              {calculationPreview?.totals?.taxBreakdown?.map((tax: any, tIdx: number) => (
                <div key={tIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  <span>{tax.taxType} ({tax.rate * 100}%):</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>₹{tax.taxAmount.toLocaleString()}</span>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Tax Amount:</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  ₹{(calculationPreview?.totals?.taxTotal || 0).toLocaleString()}
                </span>
              </div>

              {/* Grand Total */}
              <div
                style={{
                  marginTop: '0.75rem',
                  paddingTop: '0.75rem',
                  borderTop: '2px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <span style={{ fontSize: '1rem', fontWeight: 700 }}>Grand Total:</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                  ₹{(calculationPreview?.totals?.grandTotal || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Rule Trigger Warnings */}
            {calculationPreview?.ruleEffects?.appliedRules?.length > 0 && (
              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '0.85rem',
                  background: '#f5f3ff',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #ddd6fe',
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ fontWeight: 700, color: '#6d28d9', marginBottom: '0.35rem' }}>
                  ⚡ Triggered Business Rules:
                </div>
                {calculationPreview.ruleEffects.appliedRules.map((rule: any, rIdx: number) => (
                  <div key={rIdx} style={{ color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    • {rule.ruleName}: {rule.effect}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
