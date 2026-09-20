import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { Customer } from '@billing/shared';
import { DynamicFieldRenderer } from '../../components/dynamic-forms/DynamicFieldRenderer';
import { Plus, Users, Search, X, CheckCircle2, Building2, CreditCard, Award, DollarSign, Edit2, AlertCircle } from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Edit Customer Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // New Customer Form State
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [gstinOrTaxId, setGstinOrTaxId] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('Telangana');
  const [customFields, setCustomFields] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<Customer[]>(`/customers?search=${encodeURIComponent(search)}`);
      if (res.success && res.data) {
        setCustomers(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const res = await apiRequest('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          phone,
          companyName,
          gstinOrTaxId,
          billingAddress: { city, state, country: 'India' },
          customFields,
        }),
      });

      if (res.success) {
        setIsModalOpen(false);
        setName('');
        setEmail('');
        setPhone('');
        setCompanyName('');
        setGstinOrTaxId('');
        setCustomFields({});
        fetchCustomers();
      } else {
        setError(res.error?.message || 'Failed to save customer');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save customer');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForPayment || !paymentAmount || Number(paymentAmount) <= 0) return;

    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      const res = await apiRequest(`/customers/${selectedCustomerForPayment._id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(paymentAmount),
          method: paymentMethod,
          notes: paymentNotes || `Udhaar Settlement via ${paymentMethod}`,
        }),
      });

      if (res.success) {
        setIsPaymentModalOpen(false);
        setSelectedCustomerForPayment(null);
        setPaymentAmount('');
        setPaymentNotes('');
        fetchCustomers();
      } else {
        setPaymentError(res.error?.message || 'Payment processing failed');
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Payment processing failed');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Customer Directory</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
            Client accounts, GSTIN tax identifiers, Udhaar balances, and Store Credit wallets.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Add New Customer
        </button>
      </div>

      {/* Search */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.25rem' }}
            placeholder="Search by name, company, or GSTIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {customers.length} registered client account{customers.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Customer Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Company / Phone</th>
                <th>GSTIN</th>
                <th>Udhaar Balance (₹)</th>
                <th>Store Credit (₹)</th>
                <th>Loyalty Points</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                    Loading customer accounts...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                    No customer accounts matched.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.email}</div>
                    </td>
                    <td>
                      <div>{c.companyName || '-'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.phone || '-'}</div>
                    </td>
                    <td style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>{c.gstinOrTaxId || 'Unregistered'}</td>
                    <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: (c.outstandingBalance || 0) > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                      ₹{(c.outstandingBalance || 0).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                      ₹{(c.storeCreditBalance || 0).toLocaleString()}
                    </td>
                    <td>
                      <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Award size={12} /> {c.loyaltyPoints || 0} pts
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        {(c.outstandingBalance || 0) > 0 && (
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setSelectedCustomerForPayment(c);
                              setPaymentAmount(c.outstandingBalance || '');
                              setPaymentError(null);
                              setIsPaymentModalOpen(true);
                            }}
                          >
                            <DollarSign size={14} /> Record Payment
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '2rem',
              background: '#ffffff',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Register New Customer</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <p className="section-lead">Creates an active client account scoped to your organization.</p>

            {error && (
              <div
                style={{
                  background: 'var(--color-danger-bg)',
                  border: '1px solid #fecdd3',
                  color: 'var(--color-danger)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  marginBottom: '1rem',
                  fontWeight: 600,
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleCreateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Contact Person Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                  />
                  <span className="element-desc">Primary account contact</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Company Legal Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Corp Ltd."
                  />
                  <span className="element-desc">Business entity name</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="billing@acme.com"
                  />
                  <span className="element-desc">Invoices dispatched here</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                  <span className="element-desc">Direct contact phone</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">GSTIN / Tax Registration ID</label>
                  <input
                    type="text"
                    className="form-input"
                    value={gstinOrTaxId}
                    onChange={(e) => setGstinOrTaxId(e.target.value)}
                    placeholder="27AABCT3518Q1ZS"
                  />
                  <span className="element-desc">15-digit GSTIN for tax input credits</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Billing State *</label>
                  <select className="form-select" value={state} onChange={(e) => setState(e.target.value)}>
                    <option value="Telangana">Telangana</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="West Bengal">West Bengal</option>
                    <option value="Rajasthan">Rajasthan</option>
                  </select>
                  <span className="element-desc">Sets tax jurisdiction</span>
                </div>
              </div>

              {/* Dynamic Metadata Attributes */}
              <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                <DynamicFieldRenderer
                  targetEntity="customer"
                  values={customFields}
                  onChange={(key, val) => setCustomFields((prev) => ({ ...prev, [key]: val }))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  <CheckCircle2 size={16} /> Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentModalOpen && selectedCustomerForPayment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '2rem',
              background: '#ffffff',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Record Udhaar Payment</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsPaymentModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <p className="section-lead">
              Client: <strong>{selectedCustomerForPayment.name}</strong> • Outstanding: <strong>₹{(selectedCustomerForPayment.outstandingBalance || 0).toLocaleString()}</strong>
            </p>

            {paymentError && (
              <div
                style={{
                  background: 'var(--color-danger-bg)',
                  border: '1px solid #fecdd3',
                  color: 'var(--color-danger)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  marginBottom: '1rem',
                  fontWeight: 600,
                }}
              >
                {paymentError}
              </div>
            )}

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Payment Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  max={selectedCustomerForPayment.outstandingBalance || undefined}
                  className="form-input"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Enter amount..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select className="form-select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / QR Code</option>
                  <option value="card">Debit / Credit Card</option>
                  <option value="bank_transfer">Direct Bank Transfer (NEFT/IMPS)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Notes / Cheque / Ref No.</label>
                <input
                  type="text"
                  className="form-input"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. UPI Ref #829381923"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Remaining Balance:</span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  ₹{Math.max(0, (selectedCustomerForPayment.outstandingBalance || 0) - (Number(paymentAmount) || 0)).toLocaleString()}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isProcessingPayment}>
                  {isProcessingPayment ? 'Recording...' : <><CheckCircle2 size={16} /> Confirm Payment</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
