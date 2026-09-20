import React, { useState } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { Product } from '@billing/shared';

interface QuickProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  barcode: string;
  onCreated: (product: Product) => void;
}

export const QuickProductModal: React.FC<QuickProductModalProps> = ({
  isOpen,
  onClose,
  barcode,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [sku, setSku] = useState(`SKU-${Date.now().toString().slice(-5)}`);
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [costPrice, setCostPrice] = useState<number | ''>('');
  const [mrp, setMrp] = useState<number | ''>('');
  const [taxRate, setTaxRate] = useState<number>(0.18);
  const [stockQuantity, setStockQuantity] = useState<number | ''>(10);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || unitPrice === '') {
      setError('Product name and selling price are required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<Product>('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          sku: sku.trim(),
          barcode: barcode.trim(),
          barcodes: [barcode.trim()],
          unitPrice: Number(unitPrice),
          costPrice: costPrice !== '' ? Number(costPrice) : 0,
          mrp: mrp !== '' ? Number(mrp) : Number(unitPrice),
          taxRate: Number(taxRate),
          category: category.trim() || undefined,
          stockQuantity: stockQuantity !== '' ? Number(stockQuantity) : 0,
          manageInventory: true,
          type: 'goods',
        }),
      });

      if (res.success && res.data) {
        onCreated(res.data);
        onClose();
      } else {
        setError(res.error?.message || 'Failed to create product');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '12px', width: '480px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={20} style={{ color: 'var(--primary-color)' }} /> Add Unknown Barcode Item
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-danger)', borderRadius: '6px', color: 'var(--color-danger)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Barcode</label>
            <input type="text" value={barcode} disabled style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', marginTop: '0.25rem' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Product Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Amul Butter 500g" autoFocus style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', marginTop: '0.25rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>SKU *</label>
              <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} required style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', marginTop: '0.25rem' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Selling Price (₹) *</label>
              <input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value ? Number(e.target.value) : '')} required style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', marginTop: '0.25rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>MRP (₹)</label>
              <input type="number" step="0.01" value={mrp} onChange={(e) => setMrp(e.target.value ? Number(e.target.value) : '')} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', marginTop: '0.25rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Cost Price (₹)</label>
              <input type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value ? Number(e.target.value) : '')} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', marginTop: '0.25rem' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>GST Rate</label>
              <select value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                <option value={0}>0% (Exempt)</option>
                <option value={0.05}>5%</option>
                <option value={0.12}>12%</option>
                <option value={0.18}>18% (Standard)</option>
                <option value={0.28}>28%</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Initial Stock</label>
              <input type="number" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value ? Number(e.target.value) : '')} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', marginTop: '0.25rem' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.75rem 1.25rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{ padding: '0.75rem 1.5rem', borderRadius: '6px', border: 'none', background: 'var(--primary-color)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
              {loading ? 'Saving...' : 'Add & Insert to Cart'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
