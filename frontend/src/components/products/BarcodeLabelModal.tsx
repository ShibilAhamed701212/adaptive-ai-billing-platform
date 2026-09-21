import React, { useState } from 'react';
import { X, Printer, Barcode } from 'lucide-react';
import { Product } from '@billing/shared';

interface BarcodeLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({ isOpen, onClose, product }) => {
  const [copies, setCopies] = useState<number>(12);
  const [labelSize, setLabelSize] = useState<'standard' | 'compact'>('standard');

  if (!isOpen || !product) return null;

  const barcodeValue = product.barcode || (product.barcodes && product.barcodes[0]) || product.sku;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', width: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Barcode size={20} /> Print Barcode Labels: {product.name}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div className="no-print" style={{ padding: '1rem 1.5rem', display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Number of Labels</label>
            <input 
              type="number" 
              min="1" 
              max="100" 
              value={copies} 
              onChange={e => setCopies(Math.max(1, parseInt(e.target.value) || 1))} 
              style={{ width: '80px', padding: '0.4rem', marginLeft: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Label Size</label>
            <select 
              value={labelSize} 
              onChange={e => setLabelSize(e.target.value as any)}
              style={{ padding: '0.4rem', marginLeft: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            >
              <option value="standard">Standard (50mm x 25mm)</option>
              <option value="compact">Compact (38mm x 20mm)</option>
            </select>
          </div>
        </div>

        {/* Printable Grid */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
          <div style={{ display: 'grid', gridTemplateColumns: labelSize === 'standard' ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)', gap: '8px' }}>
            {Array.from({ length: copies }).map((_, index) => (
              <div 
                key={index} 
                style={{ 
                  background: '#fff', 
                  border: '1px dashed #cbd5e1', 
                  padding: '8px', 
                  borderRadius: '4px', 
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  color: '#000',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: labelSize === 'standard' ? '110px' : '90px'
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {product.name}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', margin: '2px 0' }}>
                  ₹{product.unitPrice.toFixed(2)}
                  {product.mrp && product.mrp > product.unitPrice && (
                    <span style={{ fontSize: '10px', textDecoration: 'line-through', color: '#64748b', marginLeft: '4px' }}>MRP ₹{product.mrp}</span>
                  )}
                </div>
                {/* Barcode visual lines representation */}
                <div style={{ display: 'flex', justifyContent: 'center', height: '24px', gap: '2px', alignItems: 'center' }}>
                  {barcodeValue.split('').map((char, i) => (
                    <div 
                      key={i} 
                      style={{ 
                        width: char.charCodeAt(0) % 2 === 0 ? '2px' : '1px', 
                        height: '100%', 
                        background: '#000',
                        opacity: char.charCodeAt(0) % 3 === 0 ? 0.9 : 1
                      }} 
                    />
                  ))}
                </div>
                <div style={{ fontSize: '10px', letterSpacing: '2px' }}>
                  {barcodeValue}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <button onClick={onClose} style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handlePrint} style={{ padding: '0.6rem 1.5rem', borderRadius: '6px', border: 'none', background: 'var(--accent-primary)', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <Printer size={18} /> Print {copies} Labels
          </button>
        </div>

      </div>
    </div>
  );
};
