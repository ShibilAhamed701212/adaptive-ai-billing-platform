import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import { InvoiceTemplate, Invoice } from '@billing/shared';
import { InvoiceDocument } from './InvoiceDocument';
import { Palette, Check, Save, Sparkles, Sliders, Building, ShieldCheck } from 'lucide-react';

interface InvoiceTemplateCustomizerProps {
  onTemplateSaved?: (template: InvoiceTemplate) => void;
}

const SAMPLE_INVOICE: Invoice = {
  _id: 'sample_inv_101',
  organizationId: 'sample_org',
  invoiceNumber: 'INV-2026-8801',
  customerId: 'cust_01',
  customerSnapshot: {
    name: 'Apex Horizon Technologies Pvt Ltd',
    companyName: 'Apex Horizon Group',
    email: 'finance@apexhorizon.com',
    phone: '+91 98450 11223',
    gstinOrTaxId: '29ABCDE1234F1Z5',
    billingAddress: {
      street: '42 Prestige Tech Boulevard, Outer Ring Rd',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560103',
      country: 'India',
    },
  },
  issueDate: new Date().toISOString().split('T')[0],
  dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
  currency: 'INR',
  currencySymbol: '₹',
  items: [
    {
      description: 'Enterprise Cloud Invoicing Suite - Annual License',
      unit: 'year',
      quantity: 1,
      unitPrice: 120000,
      discountAmount: 10000,
      taxRate: 0.18,
      taxAmount: 19800,
      hsnSacCode: '998313',
      lineTotal: 129800,
    },
    {
      description: 'AI Autonomous Financial Modeling Setup',
      unit: 'hrs',
      quantity: 20,
      unitPrice: 2500,
      discountAmount: 0,
      taxRate: 0.18,
      taxAmount: 9000,
      hsnSacCode: '998314',
      lineTotal: 59000,
    },
  ],
  subtotal: 170000,
  discountTotal: 10000,
  taxTotal: 28800,
  taxBreakdown: [
    { taxType: 'CGST', rate: 0.09, taxableAmount: 160000, taxAmount: 14400 },
    { taxType: 'SGST', rate: 0.09, taxableAmount: 160000, taxAmount: 14400 },
  ],
  grandTotal: 188800,
  amountPaid: 88800,
  amountDue: 100000,
  status: 'sent',
  notes: 'We appreciate your business. Please remit the remaining balance prior to due date.',
  terms: 'Payment due within 15 days of invoice date. 1.5% interest applied on late payments.',
  customFields: {
    'Project Code': 'PRJ-AI-2026',
    'PO Number': 'PO-99482-APEX',
  },
  createdBy: 'user_admin',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const COLOR_PRESETS = [
  { name: 'Indigo Dream', primary: '#4f46e5', accent: '#6366f1' },
  { name: 'Emerald Trust', primary: '#059669', accent: '#10b981' },
  { name: 'Sapphire Corporate', primary: '#0284c7', accent: '#38bdf8' },
  { name: 'Slate Executive', primary: '#334155', accent: '#64748b' },
  { name: 'Crimson Bold', primary: '#e11d48', accent: '#f43f5e' },
  { name: 'Violet Luxe', primary: '#7c3aed', accent: '#a855f7' },
];

export const InvoiceTemplateCustomizer: React.FC<InvoiceTemplateCustomizerProps> = ({ onTemplateSaved }) => {
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateName, setTemplateName] = useState<string>('Modern Corporate Invoice');
  const [templateStyle, setTemplateStyle] = useState<'modern' | 'classic' | 'minimalist' | 'gst_master' | 'pos_thermal' | 'creative'>('modern');
  const [primaryColor, setPrimaryColor] = useState<string>('#4f46e5');
  const [headerText, setHeaderText] = useState<string>('Tax Invoice');
  const [footerText, setFooterText] = useState<string>('Thank you for your business!');
  const [showLogo, setShowLogo] = useState<boolean>(true);
  const [showGstin, setShowGstin] = useState<boolean>(true);
  const [showHsnSac, setShowHsnSac] = useState<boolean>(true);
  const [showBankDetails, setShowBankDetails] = useState<boolean>(true);
  const [showPaymentTerms, setShowPaymentTerms] = useState<boolean>(true);
  const [showTaxBreakdown, setShowTaxBreakdown] = useState<boolean>(true);
  const [showCustomFields, setShowCustomFields] = useState<boolean>(true);
  const [isDefault, setIsDefault] = useState<boolean>(true);
  const [bankName, setBankName] = useState<string>('HDFC Bank Ltd');
  const [accountName, setAccountName] = useState<string>('Adaptive Solutions Pvt Ltd');
  const [accountNumber, setAccountNumber] = useState<string>('50200088192831');
  const [ifscCode, setIfscCode] = useState<string>('HDFC0000240');
  const [upiId, setUpiId] = useState<string>('adaptivebilling@hdfcbank');

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const loadTemplates = async () => {
    try {
      const res = await apiRequest<InvoiceTemplate[]>('/invoice-templates');
      if (res.success && res.data && res.data.length > 0) {
        setTemplates(res.data);
        const defaultT = res.data.find((t) => t.isDefault) || res.data[0];
        applyTemplateState(defaultT);
      }
    } catch (e) {
      console.error('Failed to load templates', e);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const applyTemplateState = (tpl: InvoiceTemplate) => {
    setSelectedTemplateId(tpl._id || '');
    setTemplateName(tpl.templateName);
    setTemplateStyle(tpl.layout.templateStyle || 'modern');
    setPrimaryColor(tpl.brandColors.primary || '#4f46e5');
    setHeaderText(tpl.layout.headerText || 'Tax Invoice');
    setFooterText(tpl.layout.footerText || '');
    setShowLogo(tpl.layout.showLogo ?? true);
    setShowGstin(tpl.layout.showGstin ?? true);
    setShowHsnSac(tpl.layout.showHsnSac ?? true);
    setShowBankDetails(tpl.layout.showBankDetails ?? true);
    setShowPaymentTerms(tpl.layout.showPaymentTerms ?? true);
    setShowTaxBreakdown(tpl.layout.showTaxBreakdown ?? true);
    setShowCustomFields(tpl.layout.showCustomFields ?? true);
    setIsDefault(Boolean(tpl.isDefault));
    if (tpl.layout.bankDetails) {
      setBankName(tpl.layout.bankDetails.bankName || '');
      setAccountName(tpl.layout.bankDetails.accountName || '');
      setAccountNumber(tpl.layout.bankDetails.accountNumber || '');
      setIfscCode(tpl.layout.bankDetails.ifscCode || '');
      setUpiId(tpl.layout.bankDetails.upiId || '');
    }
  };

  const currentTemplateObject: InvoiceTemplate = {
    templateName,
    layout: {
      templateStyle,
      showLogo,
      showGstin,
      showHsnSac,
      showBankDetails,
      showPaymentTerms,
      showTaxBreakdown,
      showCustomFields,
      headerText,
      footerText,
      bankDetails: {
        bankName,
        accountName,
        accountNumber,
        ifscCode,
        upiId,
      },
    },
    brandColors: {
      primary: primaryColor,
    },
    isDefault,
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      let res;
      if (selectedTemplateId) {
        res = await apiRequest<InvoiceTemplate>(`/invoice-templates/${selectedTemplateId}`, {
          method: 'PATCH',
          body: JSON.stringify(currentTemplateObject),
        });
      } else {
        res = await apiRequest<InvoiceTemplate>('/invoice-templates', {
          method: 'POST',
          body: JSON.stringify(currentTemplateObject),
        });
      }

      if (res.success && res.data) {
        setSaveSuccess(true);
        loadTemplates();
        if (onTemplateSaved) onTemplateSaved(res.data);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error('Failed to save template', e);
    } finally {
      setIsSaving(false);
    }
  };

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiIndustry, setAiIndustry] = useState('Technology');
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const handleAiGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt) return;
    
    setIsAiGenerating(true);
    try {
      const res = await apiRequest<any>('/ai/templates/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: aiPrompt, industry: aiIndustry }),
      });
      if (res.success && res.data) {
        // Apply AI generated config to state
        const generated = res.data;
        if (generated.templateName) setTemplateName(generated.templateName);
        if (generated.layout) {
          if (generated.layout.templateStyle) setTemplateStyle(generated.layout.templateStyle);
          setShowLogo(!!generated.layout.showLogo);
          setShowGstin(!!generated.layout.showGstin);
          setShowHsnSac(!!generated.layout.showHsnSac);
          setShowBankDetails(!!generated.layout.showBankDetails);
          setShowPaymentTerms(!!generated.layout.showPaymentTerms);
          setShowTaxBreakdown(!!generated.layout.showTaxBreakdown);
          setShowCustomFields(!!generated.layout.showCustomFields);
          if (generated.layout.headerText) setHeaderText(generated.layout.headerText);
          if (generated.layout.footerText) setFooterText(generated.layout.footerText);
        }
        if (generated.brandColors?.primary) setPrimaryColor(generated.brandColors.primary);
        setIsAiModalOpen(false);
      }
    } catch (err) {
      console.error(err);
      alert('AI Generation failed. Please try again.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '2rem', alignItems: 'start' }}>
        {/* Controls Column */}
        <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Custom Invoice Studio</h3>
              <p style={{ fontSize: '0.785rem', color: 'var(--text-muted)', margin: '0.2rem 0 0.75rem' }}>
                Design corporate invoice layout, colors & payment details
              </p>
              <button 
                type="button" 
                className="btn btn-sm" 
                style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => setIsAiModalOpen(true)}
              >
                <Sparkles size={14} /> ✨ Generate via AI
              </button>
            </div>
            {templates.length > 0 && (
              <select
                className="form-select"
                style={{ width: 'auto', fontSize: '0.8rem' }}
                value={selectedTemplateId}
                onChange={(e) => {
                  const t = templates.find((item) => item._id === e.target.value);
                  if (t) applyTemplateState(t);
                }}
              >
                <option value="">+ New Custom Template</option>
                {templates.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.templateName} {t.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Template Style Selector */}
          <div className="form-group">
            <label className="form-label">Layout Architecture</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {[
                { id: 'modern', label: 'Modern Tech' },
                { id: 'classic', label: 'Classic Corporate' },
                { id: 'gst_master', label: 'GST Tax Master' },
                { id: 'minimalist', label: 'Minimalist' },
                { id: 'pos_thermal', label: 'POS Receipt' },
                { id: 'creative', label: 'Creative Studio' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setTemplateStyle(st.id as any)}
                  style={{
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    border: templateStyle === st.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    background: templateStyle === st.id ? '#eef2ff' : '#ffffff',
                    color: templateStyle === st.id ? 'var(--accent-primary)' : 'var(--text-primary)',
                    fontWeight: templateStyle === st.id ? 700 : 500,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Template Name & Colors */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Template Name</label>
              <input
                type="text"
                className="form-input"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Standard GST Invoice"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Brand Color</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{ width: '40px', height: '38px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  className="form-input num-mono"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {['#4f46e5', '#0f172a', '#10b981', '#e11d48', '#f59e0b', '#8b5cf6', '#0284c7'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPrimaryColor(c)}
                    style={{ width: '20px', height: '20px', borderRadius: '50%', background: c, border: primaryColor === c ? '2px solid #000' : 'none', cursor: 'pointer' }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Form Checkboxes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} /> Show Branding Logo
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={showGstin} onChange={(e) => setShowGstin(e.target.checked)} /> Show GSTIN Details
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={showHsnSac} onChange={(e) => setShowHsnSac(e.target.checked)} /> Show HSN/SAC Column
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={showTaxBreakdown} onChange={(e) => setShowTaxBreakdown(e.target.checked)} /> Show Tax Summary
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={showPaymentTerms} onChange={(e) => setShowPaymentTerms(e.target.checked)} /> Show Payment Terms
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={showBankDetails} onChange={(e) => setShowBankDetails(e.target.checked)} /> Show Bank Details
            </label>
          </div>

          {/* Text Settings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Header Title</label>
              <input
                type="text"
                className="form-input"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="Tax Invoice"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Footer Message</label>
              <input
                type="text"
                className="form-input"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="Thank you for your business"
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} id="def-chk" />
            <label htmlFor="def-chk" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Set as Default Template</label>
          </div>

          {/* Bank Details section */}
          {showBankDetails && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Payment Information</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>Bank Name</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>Account Name</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>Account Number</label>
                  <input
                    type="text"
                    className="form-input num-mono"
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>IFSC Code</label>
                  <input
                    type="text"
                    className="form-input num-mono"
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>UPI ID (Instant Pay)</label>
                  <input
                    type="text"
                    className="form-input num-mono"
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
            {saveSuccess ? (
              <span style={{ color: 'var(--color-success)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                <Check size={16} /> Template Saved!
              </span>
            ) : <span />}

            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
              <Save size={16} /> {isSaving ? 'Saving...' : 'Save Template Settings'}
            </button>
          </div>
        </div>

        {/* Live Preview Column */}
        <div>
          <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Live High-Fidelity Rendering Preview
            </span>
            <span className="badge badge-paid">
              <ShieldCheck size={12} /> A4 Print Calibrated
            </span>
          </div>
          <InvoiceDocument invoice={SAMPLE_INVOICE} template={currentTemplateObject} />
        </div>
      </div>
      
      {/* AI Generate Modal */}
      {isAiModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={20} style={{ color: 'var(--accent-primary)' }} /> AI Designer
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Describe the type of invoice you need. Our AI will automatically configure the layout, toggles, and colors.
            </p>
            <form onSubmit={handleAiGenerate}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Industry / Business Type</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={aiIndustry} 
                  onChange={e => setAiIndustry(e.target.value)} 
                  placeholder="e.g. Graphic Design, Plumbing, Tech Startup"
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Describe your ideal invoice</label>
                <textarea 
                  className="form-input" 
                  rows={3} 
                  value={aiPrompt} 
                  onChange={e => setAiPrompt(e.target.value)} 
                  placeholder="e.g. A minimalist, dark-themed invoice without GSTIN or bank details. I don't need HSN/SAC codes."
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAiModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isAiGenerating} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {isAiGenerating ? 'Generating...' : <><Sparkles size={16} /> Generate</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
