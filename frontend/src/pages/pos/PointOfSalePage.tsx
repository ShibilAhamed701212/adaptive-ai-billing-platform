import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../../api/client';
import { Product, Customer } from '@billing/shared';
import { ShoppingCart, ScanLine, X, Search, Check, CreditCard, Banknote, User } from 'lucide-react';

interface CartItem extends Product {
  cartQuantity: number;
}

function useBarcodeScanner(onScan: (code: string) => void, active: boolean = true) {
  const [buffer, setBuffer] = useState('');

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Enter') {
        if (buffer) {
          onScan(buffer);
          setBuffer('');
        }
      } else if (e.key.length === 1) {
        setBuffer((prev) => prev + e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // Clear buffer if user is idle for 500ms
    const timeout = setTimeout(() => {
      if (buffer) setBuffer('');
    }, 500);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeout);
    };
  }, [buffer, active, onScan]);
}

export const PointOfSalePage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleBarcodeScan = React.useCallback((code: string) => {
    const matched = products.find((p) => p.barcode === code || p.sku === code || p.name.toLowerCase() === code.toLowerCase());
    if (matched) {
      setCart((prev) => {
        const existing = prev.find((item) => item._id === matched._id);
        if (existing) {
          return prev.map((item) =>
            item._id === matched._id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item
          );
        }
        return [...prev, { ...matched, cartQuantity: 1 }];
      });
    } else {
      alert(`Product not found for barcode: ${code}`);
    }
  }, [products]);

  useBarcodeScanner(handleBarcodeScan, !isCheckingOut);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchProducts();
  }, [debouncedSearch]);

  const fetchProducts = async () => {
    try {
      const res = await apiRequest<Product[]>(`/products?search=${encodeURIComponent(debouncedSearch)}&limit=20`);
      if (res.success && res.data) {
        setProducts(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await apiRequest<Customer[]>('/customers?limit=100');
      if (res.success && res.data) {
        setCustomers(res.data);
        // Auto-select first customer as default for POS walk-in
        if (res.data.length > 0) {
          setSelectedCustomerId(res.data[0]._id as string);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };



  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item._id === product._id);
      if (existing) {
        return prev.map((item) =>
          item._id === product._id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item
        );
      }
      return [...prev, { ...product, cartQuantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item._id !== id));
  };

  const updateQuantity = (id: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(id);
      return;
    }
    setCart((prev) => prev.map((item) => (item._id === id ? { ...item, cartQuantity: qty } : item)));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.cartQuantity, 0);
  const tax = cart.reduce((sum, item) => sum + item.unitPrice * item.cartQuantity * item.taxRate, 0);
  const total = subtotal + tax;

  const handleCheckout = async (method: 'cash' | 'card' | 'upi') => {
    if (cart.length === 0) return;
    if (!selectedCustomerId) {
      alert("Please select a customer for this transaction.");
      return;
    }
    
    setIsCheckingOut(true);
    try {
      // 1. Create Invoice
      const invoiceRes = await apiRequest('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          customerId: selectedCustomerId,
          status: 'sent', // Mark as sent for immediate processing
          items: cart.map(c => ({
            productId: c._id,
            sku: c.sku,
            description: c.name,
            unit: c.unit,
            quantity: c.cartQuantity,
            unitPrice: c.unitPrice,
            taxRate: c.taxRate,
            hsnSacCode: c.hsnSacCode
          })),
          notes: 'POS Walk-in Sale'
        })
      });

      if (invoiceRes.success && invoiceRes.data) {
        const invoiceId = invoiceRes.data._id;
        
        // 2. Record Payment immediately
        const paymentRes = await apiRequest('/payments', {
          method: 'POST',
          body: JSON.stringify({
            invoiceId,
            amount: Math.round(total * 100) / 100,
            paymentMethod: method === 'card' ? 'credit_card' : method,
            notes: 'POS Instant Settlement',
            idempotencyKey: crypto.randomUUID(),
          })
        });

        if (paymentRes.success) {
          alert(`Checkout complete! Total: ₹${total.toLocaleString(undefined, { minimumFractionDigits: 2 })} via ${method.toUpperCase()}`);
          setCart([]);
        } else {
          alert("Invoice created, but payment recording failed: " + (paymentRes.error?.message || 'Unknown error'));
        }
      } else {
        alert("Checkout failed: " + (invoiceRes.error?.message || 'Failed to generate invoice'));
      }
    } catch (e: any) {
      console.error(e);
      alert("Checkout error: " + e.message);
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', background: 'var(--bg-secondary)', margin: '-1.5rem', marginTop: '-1.5rem' }}>
      
      {/* Left: Product Selection */}
      <div style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ScanLine size={28} style={{ color: 'var(--primary-color)' }} /> 
            Terminal POS
          </h1>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              ref={searchInputRef}
              type="text"
              placeholder="Search or scan barcode (Enter)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleBarcodeScan(search);
                  setSearch('');
                }
              }}
              style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
          {products.map((p) => (
            <div 
              key={p._id as string}
              onClick={() => addToCart(p)}
              style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'all 0.2s' }}
            >
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.sku} | {p.barcode || 'No barcode'}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Stock: {p.stockQuantity || 0}</div>
              <div style={{ color: 'var(--primary-color)', fontWeight: 600, fontSize: '1.1rem', marginTop: 'auto' }}>
                ₹{p.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Cart & Checkout */}
      <div style={{ width: '400px', background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingCart size={24} /> Current Order
          </h2>
        </div>

        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <User size={14} /> Assign Customer *
          </label>
          <select 
            className="form-select"
            value={selectedCustomerId}
            onChange={e => setSelectedCustomerId(e.target.value)}
            style={{ width: '100%', fontSize: '0.9rem' }}
          >
            <option value="">-- Select Walk-in Customer --</option>
            {customers.map(c => (
              <option key={c._id as string} value={c._id as string}>{c.name}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '3rem' }}>
              <ShoppingCart size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p>Cart is empty. Scan an item.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {cart.map((item) => (
                <div key={item._id as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{item.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>₹{item.unitPrice.toLocaleString()} x {item.cartQuantity}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input 
                      type="number"
                      value={item.cartQuantity}
                      onChange={(e) => updateQuantity(item._id as string, parseInt(e.target.value) || 0)}
                      style={{ width: '60px', padding: '0.25rem', textAlign: 'center', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                    />
                    <button onClick={() => removeFromCart(item._id as string)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '0.25rem' }}>
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span>Subtotal</span>
            <span>₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span>Tax (GST)</span>
            <span>₹{tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: 700 }}>
            <span>Total</span>
            <span>₹{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '1rem' }}>
            <button 
              onClick={() => handleCheckout('cash')}
              disabled={cart.length === 0 || isCheckingOut}
              style={{ background: 'var(--color-success)', color: 'white', border: 'none', padding: '1rem', borderRadius: '8px', cursor: cart.length > 0 ? 'pointer' : 'not-allowed', opacity: (cart.length > 0 && !isCheckingOut) ? 1 : 0.5, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
            >
              <Banknote size={20} /> {isCheckingOut ? 'Processing...' : 'Cash'}
            </button>
            <button 
              onClick={() => handleCheckout('card')}
              disabled={cart.length === 0 || isCheckingOut}
              style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '1rem', borderRadius: '8px', cursor: cart.length > 0 ? 'pointer' : 'not-allowed', opacity: (cart.length > 0 && !isCheckingOut) ? 1 : 0.5, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
            >
              <CreditCard size={20} /> {isCheckingOut ? 'Processing...' : 'Card'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
