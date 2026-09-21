import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { Product } from '@billing/shared';
import { DynamicFieldRenderer } from '../../components/dynamic-forms/DynamicFieldRenderer';
import { Plus, Package, Search, X, CheckCircle2, Barcode, Trash2, Edit2 } from 'lucide-react';
import { BarcodeLabelModal } from '../../components/products/BarcodeLabelModal';

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedProductForLabels, setSelectedProductForLabels] = useState<Product | null>(null);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState<boolean>(false);

  // New Product Form State
  const [name, setName] = useState<string>('');
  const [sku, setSku] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [type, setType] = useState<'goods' | 'service' | 'subscription' | 'usage'>('goods');
  const [unit, setUnit] = useState<string>('');
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0.18);
  const [hsnSacCode, setHsnSacCode] = useState<string>('998313');
  const [stockQuantity, setStockQuantity] = useState<number>(0);
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [customFields, setCustomFields] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<Product[]>(`/products?search=${encodeURIComponent(search)}`);
      if (res.success && res.data) {
        setProducts(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const res = await apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify({
          name,
          sku,
          description,
          type,
          unit,
          unitPrice: Number(unitPrice),
          taxRate: Number(taxRate),
          hsnSacCode,
          stockQuantity: type === 'goods' ? Number(stockQuantity) : 0,
          expiryDate: type === 'goods' && expiryDate ? expiryDate : undefined,
          customFields,
        }),
      });

      if (res.success) {
        setIsModalOpen(false);
        setName('');
        setSku('');
        setDescription('');
        setUnit('');
        setUnitPrice(0);
        setStockQuantity(0);
        setExpiryDate('');
        setCustomFields({});
        fetchProducts();
      } else {
        setError(res.error?.message || 'Failed to save product');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Products & Services Catalog</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
            Manage billable items, subscription tiers, unit rate cards, and HSN/SAC statutory codes.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Add New Product/Service
        </button>
      </div>

      {/* Search Bar */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.25rem' }}
            placeholder="Search by SKU, name, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {products.length} catalog item{products.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Products Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product / Service</th>
                <th>SKU Identifier</th>
                <th>Category</th>
                <th>Unit Type</th>
                <th>Stock / Qty</th>
                <th>Base Unit Price (₹)</th>
                <th>Default Tax Slab</th>
                <th>HSN / SAC</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                    Loading catalog items...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                    No catalog items found. Click "Add New Product/Service" to create one.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.description || '-'}</div>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                      {p.sku}
                    </td>
                    <td>
                      <span className="badge badge-draft" style={{ textTransform: 'capitalize' }}>
                        {p.type}
                      </span>
                    </td>
                    <td>{p.unit}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {p.type === 'goods' ? (
                        <>
                          <div style={{ fontWeight: 600 }}>{p.stockQuantity || 0}</div>
                          {p.expiryDate && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Exp: {p.expiryDate}</div>}
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      ₹{p.unitPrice.toLocaleString()}
                    </td>
                    <td>{p.taxRate * 100}% GST</td>
                    <td style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>{p.hsnSacCode || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setSelectedProductForLabels(p);
                          setIsLabelModalOpen(true);
                        }}
                        title="Print Barcode Labels"
                      >
                        <Barcode size={15} /> Print Labels
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
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
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Add Catalog Item</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <p className="section-lead">Registers a billable product or service with deterministic pricing.</p>

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

            <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Item / Service Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Enterprise Cloud Suite"
                  />
                  <span className="element-desc">Primary name printed on invoices</span>
                </div>
                <div className="form-group">
                  <label className="form-label">SKU / Code *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    placeholder="CLOUD-ENT"
                  />
                  <span className="element-desc">Unique alphanumeric SKU</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed deliverables, inclusions, or specifications..."
                />
                <span className="element-desc">Pre-filled on invoice line items</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-select" value={type} onChange={(e) => setType(e.target.value as any)}>
                    <option value="goods">Goods / Product</option>
                    <option value="service">Service</option>
                    <option value="subscription">Subscription</option>
                    <option value="usage">Usage / Metered</option>
                  </select>
                  <span className="element-desc">Item billing model</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Unit Type</label>
                  <input
                    type="text"
                    className="form-input"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder={type === 'goods' ? 'box, kg, pc, unit' : 'month, hr, session'}
                  />
                  <span className="element-desc">Pricing unit</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Base Rate (₹) *</label>
                  <input
                    type="number"
                    required
                    className="form-input"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                  />
                  <span className="element-desc">Default unit rate</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Default Tax Slab</label>
                  <select className="form-select" value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value))}>
                    <option value="0">0% (Exempt)</option>
                    <option value="0.05">5% GST</option>
                    <option value="0.12">12% GST</option>
                    <option value="0.18">18% GST</option>
                    <option value="0.28">28% GST</option>
                  </select>
                  <span className="element-desc">Standard statutory tax</span>
                </div>

                <div className="form-group">
                  <label className="form-label">HSN / SAC Code</label>
                  <input
                    type="text"
                    className="form-input"
                    value={hsnSacCode}
                    onChange={(e) => setHsnSacCode(e.target.value)}
                    placeholder="998313"
                  />
                  <span className="element-desc">Tax accounting code</span>
                </div>
              </div>

              {type === 'goods' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Opening Stock Quantity</label>
                    <input
                      type="number"
                      className="form-input"
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                    <span className="element-desc">Current inventory level</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Expiration Date (Optional)</label>
                    <input
                      type="date"
                      className="form-input"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                    />
                    <span className="element-desc">Valid until date</span>
                  </div>
                </div>
              )}

              {/* Dynamic Metadata Attributes */}
              <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                <DynamicFieldRenderer
                  targetEntity="product"
                  values={customFields}
                  onChange={(key, val) => setCustomFields((prev) => ({ ...prev, [key]: val }))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  <CheckCircle2 size={16} /> Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Label Print Modal */}
      <BarcodeLabelModal
        isOpen={isLabelModalOpen}
        onClose={() => {
          setIsLabelModalOpen(false);
          setSelectedProductForLabels(null);
        }}
        product={selectedProductForLabels}
      />
    </div>
  );
};
