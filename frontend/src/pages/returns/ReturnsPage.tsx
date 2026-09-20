import React, { useState, useEffect } from 'react';
import { RotateCcw, Search, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../api/client';

interface InvoiceItem {
  productId: string;
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  customerName?: string;
  grandTotal: number;
  items: InvoiceItem[];
}

interface ReturnItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  maxQuantity: number;
  reason: string;
}

interface ReturnRecord {
  _id: string;
  returnNumber: string;
  date: string;
  totalRefundAmount: number;
  refundMethod: string;
}

export const ReturnsPage = () => {
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal & Lookup states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchInvoiceId, setSearchInvoiceId] = useState('');
  const [foundInvoice, setFoundInvoice] = useState<Invoice | null>(null);
  const [lookupError, setLookupError] = useState('');

  // Return / Exchange Form states
  const [activeTab, setActiveTab] = useState<'return' | 'exchange'>('return');
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [exchangeItems, setExchangeItems] = useState<Array<{ productId: string; name: string; sku: string; unitPrice: number; quantity: number }>>([]);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [differenceMethod, setDifferenceMethod] = useState('cash');
  const [globalReason, setGlobalReason] = useState('Customer changed mind');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchReturns();
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      const res = await apiRequest('/products?limit=100');
      if (res.success && res.data) setCatalogProducts(res.data);
    } catch {
      // ignore
    }
  };

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/returns');
      if (res.success) setReturns(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLookupInvoice = async () => {
    if (!searchInvoiceId) return;
    setLookupError('');
    setFoundInvoice(null);
    setReturnItems([]);
    try {
      // Endpoint to get invoice by ID or Number. Let's assume we can fetch by querying GET /invoices?search=...
      // Usually there is a GET /invoices/:id but we'll try GET /invoices
      const res = await apiRequest(`/invoices?search=${searchInvoiceId}`);
      if (res.success && res.data.length > 0) {
        // Find exact match or take first
        const invoice = res.data.find((i: any) => i.invoiceNumber === searchInvoiceId || i._id === searchInvoiceId) || res.data[0];
        setFoundInvoice(invoice);
        
        // Initialize return items (qty 0 by default)
        setReturnItems(invoice.items.map((item: any) => ({
          productId: item.productId || item._id,
          sku: item.sku || '',
          name: item.description,
          quantity: 0,
          maxQuantity: item.quantity,
          reason: ''
        })));
      } else {
        setLookupError('Invoice not found');
      }
    } catch (err: any) {
      setLookupError('Error looking up invoice');
    }
  };

  const handleUpdateReturnItem = (index: number, field: keyof ReturnItem, value: any) => {
    const updated = [...returnItems];
    updated[index] = { ...updated[index], [field]: value };
    setReturnItems(updated);
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundInvoice) return;

    const itemsToReturn = returnItems.filter(i => i.quantity > 0);
    if (itemsToReturn.length === 0) {
      setError('Please specify at least one item to return with quantity > 0.');
      return;
    }

    setError('');
    setIsSaving(true);

    try {
      const isExchange = activeTab === 'exchange';
      if (isExchange && exchangeItems.length === 0) {
        setError('Please select at least one replacement item for the exchange.');
        return;
      }

      const payload = {
        invoiceId: foundInvoice._id,
        items: itemsToReturn,
        refundMethod,
        reason: globalReason,
        isExchange,
        exchangeItems: isExchange ? exchangeItems : undefined,
        differenceSettledVia: isExchange ? differenceMethod : undefined,
      };

      const res = await apiRequest('/returns', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        setIsModalOpen(false);
        setSearchInvoiceId('');
        setFoundInvoice(null);
        setReturnItems([]);
        setExchangeItems([]);
        fetchReturns();
      } else {
        setError(res.error?.message || 'Failed to process return');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <RotateCcw className="text-primary" /> Returns & Refunds
          </h1>
          <p className="text-muted">Process customer returns and issue refunds.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <RotateCcw size={18} /> Process Return
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '0.75rem', fontWeight: 600 }}>Return #</th>
                  <th style={{ padding: '0.75rem', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '0.75rem', fontWeight: 600 }}>Refund Amount</th>
                  <th style={{ padding: '0.75rem', fontWeight: 600 }}>Method</th>
                </tr>
              </thead>
              <tbody>
                {returns.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No returns found.
                    </td>
                  </tr>
                ) : (
                  returns.map((r) => (
                    <tr key={r._id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.75rem', fontFamily: 'var(--font-mono)' }}>{r.returnNumber}</td>
                      <td style={{ padding: '0.75rem' }}>{new Date(r.date).toLocaleDateString()}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--color-danger)' }}>-₹{r.totalRefundAmount.toLocaleString()}</td>
                      <td style={{ padding: '0.75rem', textTransform: 'capitalize' }}>{r.refundMethod.replace('_', ' ')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem',
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '700px', padding: '2rem', background: '#ffffff',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Process Return</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
            </div>

            {/* Lookup Section */}
            {!foundInvoice && (
              <div style={{ marginBottom: '2rem' }}>
                <label className="form-label">Lookup Invoice ID or Number</label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. INV-123456" 
                    value={searchInvoiceId} 
                    onChange={(e) => setSearchInvoiceId(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleLookupInvoice()}
                  />
                  <button className="btn btn-secondary" onClick={handleLookupInvoice}>
                    <Search size={18} /> Search
                  </button>
                </div>
                {lookupError && <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem', marginTop: '0.5rem' }}>{lookupError}</p>}
              </div>
            )}

            {/* Process Section */}
            {foundInvoice && (
              <form onSubmit={handleProcessReturn}>
                {/* Return vs Exchange Toggle */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${activeTab === 'return' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('return')}
                  >
                    Direct Return & Refund
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${activeTab === 'exchange' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('exchange')}
                  >
                    Direct Item Exchange
                  </button>
                </div>

                <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600 }}>Invoice: {foundInvoice.invoiceNumber}</span>
                    <span style={{ fontWeight: 600 }}>Total: ₹{foundInvoice.grandTotal.toLocaleString()}</span>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 0 }} onClick={() => setFoundInvoice(null)}>
                    Change Invoice
                  </button>
                </div>

                {error && (
                  <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={18} /> {error}
                  </div>
                )}

                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>1. Select Items to Return</h3>
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <th style={{ padding: '0.5rem' }}>Product</th>
                        <th style={{ padding: '0.5rem' }}>Purchased</th>
                        <th style={{ padding: '0.5rem' }}>Unit Price</th>
                        <th style={{ padding: '0.5rem' }}>Return Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnItems.map((item, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.5rem' }}>{item.name}</td>
                          <td style={{ padding: '0.5rem' }}>{item.maxQuantity}</td>
                          <td style={{ padding: '0.5rem', fontFamily: 'var(--font-mono)' }}>
                            ₹{foundInvoice.items.find(i => String(i.productId || (i as any)._id) === String(item.productId))?.unitPrice || 0}
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <input 
                              type="number" 
                              min="0" 
                              max={item.maxQuantity}
                              className="form-input" 
                              style={{ width: '80px', padding: '0.25rem' }} 
                              value={item.quantity} 
                              onChange={(e) => handleUpdateReturnItem(index, 'quantity', Number(e.target.value))} 
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Replacement Products Section (Exchange Mode) */}
                {activeTab === 'exchange' && (
                  <div style={{ marginBottom: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', background: '#f8fafc' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>2. Choose Replacement Products</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                      <select
                        className="form-select"
                        style={{ flex: 1 }}
                        value=""
                        onChange={(e) => {
                          const prod = catalogProducts.find(p => p._id === e.target.value);
                          if (prod) {
                            setExchangeItems(prev => {
                              const existing = prev.find(i => i.productId === prod._id);
                              if (existing) {
                                return prev.map(i => i.productId === prod._id ? { ...i, quantity: i.quantity + 1 } : i);
                              }
                              return [...prev, { productId: prod._id, name: prod.name, sku: prod.sku, unitPrice: prod.unitPrice, quantity: 1 }];
                            });
                          }
                        }}
                      >
                        <option value="">-- Add replacement product from catalog --</option>
                        {catalogProducts.map(p => (
                          <option key={p._id} value={p._id}>{p.name} ({p.sku}) - ₹{p.unitPrice} [Stock: {p.stockQuantity ?? 'N/A'}]</option>
                        ))}
                      </select>
                    </div>

                    {exchangeItems.length > 0 && (
                      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <th style={{ padding: '0.5rem' }}>Replacement Item</th>
                            <th style={{ padding: '0.5rem' }}>Unit Price</th>
                            <th style={{ padding: '0.5rem' }}>Qty</th>
                            <th style={{ padding: '0.5rem' }}>Subtotal</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exchangeItems.map((ex, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '0.5rem' }}>{ex.name}</td>
                              <td style={{ padding: '0.5rem' }}>₹{ex.unitPrice}</td>
                              <td style={{ padding: '0.5rem' }}>
                                <input
                                  type="number"
                                  min="1"
                                  className="form-input"
                                  style={{ width: '70px', padding: '0.2rem' }}
                                  value={ex.quantity}
                                  onChange={(e) => {
                                    const val = Math.max(1, Number(e.target.value) || 1);
                                    setExchangeItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: val } : item));
                                  }}
                                />
                              </td>
                              <td style={{ padding: '0.5rem', fontWeight: 600 }}>₹{(ex.unitPrice * ex.quantity).toLocaleString()}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  style={{ color: 'var(--color-danger)', padding: '0.2rem' }}
                                  onClick={() => setExchangeItems(prev => prev.filter((_, i) => i !== idx))}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Calculation Summary Bar */}
                {(() => {
                  const returnSubtotal = returnItems.reduce((sum, item) => {
                    const price = foundInvoice.items.find(i => String(i.productId || (i as any)._id) === String(item.productId))?.unitPrice || 0;
                    return sum + (item.quantity * price);
                  }, 0);
                  const replacementSubtotal = exchangeItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
                  const netDifference = replacementSubtotal - returnSubtotal;

                  return (
                    <div style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Returned Item Value: ₹{returnSubtotal.toLocaleString()}</div>
                        {activeTab === 'exchange' && (
                          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Replacement Items Value: ₹{replacementSubtotal.toLocaleString()}</div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {activeTab === 'return' ? (
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-danger)' }}>
                            Refund: ₹{returnSubtotal.toLocaleString()}
                          </div>
                        ) : (
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: netDifference > 0 ? 'var(--color-success)' : netDifference < 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                            {netDifference > 0 ? `Customer Pays Difference: ₹${netDifference.toLocaleString()}` : netDifference < 0 ? `Refund Difference: ₹${Math.abs(netDifference).toLocaleString()}` : 'Even Exchange (₹0 Difference)'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Reason</label>
                    <select className="form-select" value={globalReason} onChange={(e) => setGlobalReason(e.target.value)}>
                      <option value="Customer changed mind">Customer changed mind</option>
                      <option value="Defective / Damaged">Defective / Damaged</option>
                      <option value="Size / Variant exchange">Size / Variant exchange</option>
                      <option value="Wrong item shipped">Wrong item shipped</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{activeTab === 'exchange' ? 'Difference Settlement Mode' : 'Refund Method'}</label>
                    <select
                      className="form-select"
                      value={activeTab === 'exchange' ? differenceMethod : refundMethod}
                      onChange={(e) => activeTab === 'exchange' ? setDifferenceMethod(e.target.value) : setRefundMethod(e.target.value)}
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI / QR Code</option>
                      <option value="card">Card</option>
                      <option value="store_credit">Store Credit</option>
                      <option value="customer_balance">Customer Account Balance</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={isSaving}>
                    <CheckCircle2 size={16} /> {activeTab === 'exchange' ? 'Complete Exchange' : 'Confirm Return'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
