import React, { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Search, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../api/client';

interface Supplier {
  _id: string;
  name: string;
}

interface Product {
  _id: string;
  name: string;
  sku: string;
  costPrice: number;
  taxRate: number;
}

interface PurchaseItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

interface Purchase {
  _id: string;
  purchaseNumber: string;
  supplierId: string;
  date: string;
  grandTotal: number;
  amountDue: number;
  status: string;
}

export const PurchasesPage = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [purchasesRes, suppliersRes, productsRes] = await Promise.all([
        apiRequest('/purchases'),
        apiRequest('/suppliers'),
        apiRequest('/products'),
      ]);
      if (purchasesRes.success) setPurchases(purchasesRes.data);
      if (suppliersRes.success) setSuppliers(suppliersRes.data);
      if (productsRes.success) setProducts(productsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = () => {
    if (!selectedProductId) return;
    const prod = products.find((p) => p._id === selectedProductId);
    if (!prod) return;

    setPurchaseItems((prev) => [
      ...prev,
      {
        productId: prod._id,
        sku: prod.sku || '',
        name: prod.name,
        quantity: 1,
        unitPrice: prod.costPrice || 0,
        taxRate: prod.taxRate || 0,
      },
    ]);
    setSelectedProductId('');
  };

  const handleUpdateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    const updated = [...purchaseItems];
    updated[index] = { ...updated[index], [field]: value };
    setPurchaseItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = [...purchaseItems];
    updated.splice(index, 1);
    setPurchaseItems(updated);
  };

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || purchaseItems.length === 0) {
      setError('Please select a supplier and add at least one product.');
      return;
    }
    setError('');
    setIsSaving(true);

    try {
      const payload = {
        supplierId,
        items: purchaseItems,
        amountPaid: Number(amountPaid),
        notes,
        status: 'RECEIVED'
      };

      const res = await apiRequest('/purchases', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        setIsModalOpen(false);
        setSupplierId('');
        setPurchaseItems([]);
        setAmountPaid(0);
        setNotes('');
        fetchData();
      } else {
        setError(res.error?.message || 'Failed to record purchase');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const grandTotal = purchaseItems.reduce((acc, item) => {
    const sub = item.quantity * item.unitPrice;
    const tax = sub * item.taxRate;
    return acc + sub + tax;
  }, 0);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ShoppingBag className="text-primary" /> Purchases
          </h1>
          <p className="text-muted">Manage supplier purchases and inbound inventory.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Record Purchase
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
                  <th style={{ padding: '0.75rem', fontWeight: 600 }}>PO Number</th>
                  <th style={{ padding: '0.75rem', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '0.75rem', fontWeight: 600 }}>Total</th>
                  <th style={{ padding: '0.75rem', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No purchases found.
                    </td>
                  </tr>
                ) : (
                  purchases.map((p) => (
                    <tr key={p._id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.75rem', fontFamily: 'var(--font-mono)' }}>{p.purchaseNumber}</td>
                      <td style={{ padding: '0.75rem' }}>{new Date(p.date).toLocaleDateString()}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>₹{p.grandTotal.toLocaleString()}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className="badge badge-success">{p.status}</span>
                      </td>
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
            width: '100%', maxWidth: '800px', padding: '2rem', background: '#ffffff',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Record New Purchase</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
            </div>

            {error && (
              <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={18} /> {error}
              </div>
            )}

            <form onSubmit={handleCreatePurchase}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Supplier *</label>
                <select className="form-select" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>

              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <select className="form-select" style={{ flex: 1 }} value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
                    <option value="">-- Select Product --</option>
                    {products.map(p => <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>)}
                  </select>
                  <button type="button" className="btn btn-secondary" onClick={handleAddProduct}>Add</button>
                </div>

                {purchaseItems.length > 0 && (
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <th style={{ padding: '0.5rem' }}>Product</th>
                        <th style={{ padding: '0.5rem' }}>Qty</th>
                        <th style={{ padding: '0.5rem' }}>Cost Price</th>
                        <th style={{ padding: '0.5rem' }}>GST %</th>
                        <th style={{ padding: '0.5rem' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseItems.map((item, index) => (
                        <tr key={index}>
                          <td style={{ padding: '0.5rem' }}>{item.name}</td>
                          <td style={{ padding: '0.5rem' }}>
                            <input type="number" min="1" className="form-input" style={{ width: '80px', padding: '0.25rem' }} value={item.quantity} onChange={(e) => handleUpdateItem(index, 'quantity', Number(e.target.value))} />
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <input type="number" step="0.01" className="form-input" style={{ width: '100px', padding: '0.25rem' }} value={item.unitPrice} onChange={(e) => handleUpdateItem(index, 'unitPrice', Number(e.target.value))} />
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <input type="number" step="0.01" className="form-input" style={{ width: '80px', padding: '0.25rem' }} value={(item.taxRate * 100).toFixed(0)} onChange={(e) => handleUpdateItem(index, 'taxRate', Number(e.target.value) / 100)} />
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                            <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleRemoveItem(index)}>
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..."></textarea>
                </div>
                <div>
                  <div className="form-group">
                    <label className="form-label">Amount Paid</label>
                    <input type="number" className="form-input" value={amountPaid} onChange={(e) => setAmountPaid(Number(e.target.value))} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', fontWeight: 600, fontSize: '1.125rem' }}>
                    <span>Grand Total:</span>
                    <span>₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSaving || purchaseItems.length === 0}>
                  <CheckCircle2 size={16} /> Receive Purchase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
