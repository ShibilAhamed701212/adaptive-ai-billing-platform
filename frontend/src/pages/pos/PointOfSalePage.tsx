import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Product, Customer } from '@billing/shared';
import { ShoppingCart, ScanLine, X, Search, Check, Banknote, User, Tag, AlertTriangle, RefreshCw, Cloud } from 'lucide-react';
import { CheckoutModal } from '../../components/pos/CheckoutModal';
import { CustomerAutocomplete } from '../../components/pos/CustomerAutocomplete';
import { QuickProductModal } from '../../components/pos/QuickProductModal';
import { ThermalReceiptModal } from '../../components/pos/ThermalReceiptModal';
import { queueOfflineSale, getQueuedSales, removeQueuedSale } from '../../utils/offlineDb';
import { usePOSCart } from '../../context/POSCartContext';

interface CartItem extends Product {
  cartQuantity: number;
  lineDiscount?: number;
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
  const { organization } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState('');
  
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [queuedSales, setQueuedSales] = useState<any[]>([]);
  const [isSyncTrayOpen, setIsSyncTrayOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const {
    cart,
    selectedCustomerId,
    setSelectedCustomerId,
    billDiscount,
    setBillDiscount,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateLineDiscount,
    clearCart,
    subtotal,
    totalDiscount,
    tax,
    total,
  } = usePOSCart();

  const searchInputRef = useRef<HTMLInputElement>(null);

  const refreshQueuedSales = async () => {
    try {
      const q = await getQueuedSales();
      setQueuedSales(q || []);
    } catch (e) {
      console.error('Failed to load queued sales', e);
    }
  };

  useEffect(() => {
    fetchCustomers();
    refreshQueuedSales();
    
    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineSales();
    };
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncOfflineSales = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const queued = await getQueuedSales();
      for (const sale of queued) {
        try {
          const res = await apiRequest('/pos/checkout', {
            method: 'POST',
            body: JSON.stringify(sale.payload)
          });
          if (res.success) {
            await removeQueuedSale(sale.localId);
          }
        } catch (e) {
          console.error("Failed to sync sale", sale, e);
        }
      }
      await refreshQueuedSales();
    } finally {
      setSyncing(false);
    }
  };

  const handleBarcodeScan = React.useCallback(async (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    const matched = products.find(
      (p) =>
        p.barcode === cleanCode ||
        (p.barcodes && p.barcodes.includes(cleanCode)) ||
        p.sku.toUpperCase() === cleanCode.toUpperCase() ||
        p.name.toLowerCase() === cleanCode.toLowerCase()
    );

    if (matched) {
      addToCart(matched);
      return;
    }

    try {
      const res = await apiRequest<Product>(`/products/barcode/${encodeURIComponent(cleanCode)}`);
      if (res.success && res.data) {
        const prod = res.data;
        setProducts((prev) => (prev.some((p) => p._id === prod._id) ? prev : [prod, ...prev]));
        addToCart(prod);
      } else {
        setUnknownBarcode(cleanCode);
        setIsQuickProductModalOpen(true);
      }
    } catch (e) {
      setUnknownBarcode(cleanCode);
      setIsQuickProductModalOpen(true);
    }
  }, [products, addToCart]);

  useBarcodeScanner(handleBarcodeScan, !isCheckingOut && !isQuickProductModalOpen);

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
      const res = await apiRequest<Product[]>(`/products?search=${encodeURIComponent(debouncedSearch)}&limit=30`);
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
        if (res.data.length > 0 && !selectedCustomerId) {
          setSelectedCustomerId(res.data[0]._id as string);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openCheckout = () => {
    if (cart.length === 0) return;
    // A walk-in (no customer) is allowed for fully-paid sales; the backend
    // enforces that credit sales require a customer.
    setIsCheckoutModalOpen(true);
  };

  const handleConfirmCheckout = async (
    payments: { method: string; amount: number }[],
    tenderDetails: { amountTendered: number; changeGiven: number },
    loyaltyDetails?: { pointsRedeemed: number; discountAmount: number }
  ) => {
    setIsCheckingOut(true);
    
    const checkoutPayload = {
      customerId: selectedCustomerId,
      items: cart.map(c => ({
        productId: c._id,
        quantity: c.cartQuantity,
        unitPrice: c.unitPrice,
        discountAmount: c.lineDiscount || 0,
      })),
      invoiceDiscountAmount: billDiscount,
      splitPayments: payments,
      amountTendered: tenderDetails.amountTendered,
      changeGiven: tenderDetails.changeGiven,
      notes: 'POS Sale',
      clientTransactionId: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      loyaltyPointsRedeemed: loyaltyDetails?.pointsRedeemed || 0,
    };

    try {
      if (isOffline) {
        await queueOfflineSale({ payload: checkoutPayload });
        await refreshQueuedSales();
        alert("You are offline. Sale queued and will sync when connection returns.");
        
        setReceiptData({
          storeName: organization?.name || 'Store',
          storeAddress: organization?.settings?.address?.city ? `${organization.settings.address.street || ''} ${organization.settings.address.city}`.trim() : undefined,
          gstin: organization?.settings?.gstinOrTaxId,
          invoiceNumber: `OFFLINE-${Date.now()}`,
          date: new Date().toLocaleString(),
          customerName: customers.find(c => c._id === selectedCustomerId)?.name || 'Walk-in Customer',
          items: cart.map(c => ({
            name: c.name,
            quantity: c.cartQuantity,
            unitPrice: c.unitPrice,
            lineTotal: c.cartQuantity * c.unitPrice - (c.lineDiscount || 0)
          })),
          subtotal: subtotal,
          discountTotal: totalDiscount,
          taxTotal: tax,
          grandTotal: total,
          amountTendered: tenderDetails.amountTendered,
          changeGiven: tenderDetails.changeGiven,
          payments,
          loyaltyPointsRedeemed: loyaltyDetails?.pointsRedeemed || 0,
          customerRemainingPoints: Math.max(0, (customers.find(c => c._id === selectedCustomerId)?.loyaltyPoints || 0) - (loyaltyDetails?.pointsRedeemed || 0)),
        });
        setIsReceiptModalOpen(true);
        clearCart();
        setIsCheckoutModalOpen(false);
      } else {
        const res = await apiRequest('/pos/checkout', {
          method: 'POST',
          body: JSON.stringify(checkoutPayload)
        });

        if (res.success) {
          const inv = res.data.invoice;
          setReceiptData({
            storeName: organization?.name || 'Store',
            storeAddress: organization?.settings?.address?.city
              ? `${organization.settings.address.street || ''} ${organization.settings.address.city}`.trim()
              : undefined,
            gstin: organization?.settings?.gstinOrTaxId,
            invoiceNumber: inv.invoiceNumber,
            date: new Date(inv.issueDate).toLocaleString(),
            customerName: inv.customerSnapshot?.name,
            items: inv.items.map((i: any) => ({
              name: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              lineTotal: i.lineTotal
            })),
            subtotal: inv.subtotal,
            discountTotal: inv.discountTotal,
            taxTotal: inv.taxTotal,
            grandTotal: inv.grandTotal,
            amountTendered: inv.amountTendered || tenderDetails.amountTendered,
            changeGiven: inv.changeGiven || tenderDetails.changeGiven,
            payments: inv.paymentHistory || payments,
            loyaltyPointsRedeemed: inv.loyaltyPointsRedeemed || loyaltyDetails?.pointsRedeemed || 0,
            customerRemainingPoints: inv.customerLoyaltyPointsBalance !== undefined ? inv.customerLoyaltyPointsBalance : undefined,
          });
          
          setIsReceiptModalOpen(true);
          clearCart();
          fetchCustomers();
          setIsCheckoutModalOpen(false);
        } else {
          alert("Checkout failed: " + (res.error?.message || 'Unknown error'));
        }
      }
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('Network') || e.message?.includes('fetch')) {
         await queueOfflineSale({ payload: checkoutPayload });
         await refreshQueuedSales();
         alert("Network error. Sale queued for offline sync.");
         clearCart();
         setIsCheckoutModalOpen(false);
      } else {
         alert("Checkout error: " + e.message);
      }
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleHoldBill = async () => {
    if (cart.length === 0) return;
    try {
      await apiRequest('/pos/held-bills', {
        method: 'POST',
        body: JSON.stringify({
          notes: `Held on ${new Date().toLocaleTimeString()}`,
          items: cart.map(c => ({
            productId: c._id,
            sku: c.sku,
            name: c.name,
            unitPrice: c.unitPrice,
            cartQuantity: c.cartQuantity,
            lineDiscount: c.lineDiscount || 0,
            taxRate: c.taxRate || 0,
            stockQuantity: c.stockQuantity,
            barcode: c.barcode,
          })),
          customerId: selectedCustomerId || undefined,
        })
      });
      alert('Bill held successfully');
      clearCart();
    } catch (err) {
      console.error(err);
      alert('Failed to hold bill');
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', background: 'var(--bg-secondary)', margin: '-1.5rem', marginTop: '-1.5rem' }}>
      
      {/* Left: Product Selection */}
      <div style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ScanLine size={28} style={{ color: 'var(--accent-primary)' }} /> 
              Terminal POS
            </h1>
            {isOffline && (
              <span className="badge" style={{ background: 'var(--color-danger)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                <AlertTriangle size={14} /> OFFLINE MODE
              </span>
            )}
            <button
              onClick={() => setIsSyncTrayOpen(true)}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem' }}
              title="View Offline Queue"
            >
              <Cloud size={16} />
              <span>Offline Queue</span>
              {queuedSales.length > 0 && (
                <span style={{ background: 'var(--accent-primary)', color: '#fff', borderRadius: '10px', padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>
                  {queuedSales.length}
                </span>
              )}
            </button>
          </div>
          <div style={{ flex: 1, maxWidth: '400px', position: 'relative' }}>
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
              <div style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: '1.1rem', marginTop: 'auto' }}>
                ₹{p.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Cart & Checkout */}
      <div style={{ width: '400px', background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingCart size={24} /> Current Order
          </h2>
          <button 
            onClick={handleHoldBill}
            disabled={cart.length === 0}
            className="btn btn-secondary btn-sm"
          >
            Park Bill
          </button>
        </div>

        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <User size={14} /> Assign customer (optional — walk-in allowed)
          </label>
          <CustomerAutocomplete 
            customers={customers}
            selectedCustomerId={selectedCustomerId}
            onSelect={setSelectedCustomerId}
            onCustomerAdded={(c) => {
              setCustomers(prev => [...prev, c]);
              setSelectedCustomerId(c._id as string);
            }}
          />
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
                <div key={item._id as string} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.5rem 0', borderBottom: '1px dashed var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{item.name}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        ₹{item.unitPrice.toLocaleString()} x {item.cartQuantity}
                        {item.mrp && item.mrp > item.unitPrice && (
                          <span style={{ textDecoration: 'line-through', marginLeft: '0.5rem', color: 'var(--text-muted)' }}>MRP ₹{item.mrp}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input 
                        type="number"
                        min="1"
                        value={item.cartQuantity}
                        onChange={(e) => updateQuantity(item._id as string, parseInt(e.target.value) || 0)}
                        style={{ width: '55px', padding: '0.25rem', textAlign: 'center', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                      />
                      <button onClick={() => removeFromCart(item._id as string)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '0.25rem' }}>
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Tag size={12} /> Item Discount (₹):
                    </span>
                    <input 
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="0"
                      value={item.lineDiscount || ''}
                      onChange={(e) => updateLineDiscount(item._id as string, parseFloat(e.target.value) || 0)}
                      style={{ width: '70px', padding: '0.2rem', textAlign: 'right', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <span>Subtotal</span>
            <span>₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Tag size={14} /> Bill Discount (₹)
            </span>
            <input 
              type="number"
              min="0"
              placeholder="0.00"
              value={billDiscount || ''}
              onChange={(e) => setBillDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
              style={{ width: '80px', padding: '0.25rem', textAlign: 'right', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </div>

          {totalDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)', fontSize: '0.9rem' }}>
              <span>Total Discount Savings</span>
              <span>-₹{totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <span>Tax (GST)</span>
            <span>₹{tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem', fontWeight: 700, paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
            <span>Grand Total</span>
            <span>₹{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <button 
              onClick={openCheckout}
              disabled={cart.length === 0 || isCheckingOut}
              style={{ width: '100%', background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '0.9rem', borderRadius: '8px', cursor: cart.length > 0 ? 'pointer' : 'not-allowed', opacity: (cart.length > 0 && !isCheckingOut) ? 1 : 0.5, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1.1rem' }}
            >
              <Check size={20} /> {isCheckingOut ? 'Processing...' : 'Checkout'}
            </button>
          </div>
        </div>
      </div>
      
      <CheckoutModal 
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        onConfirm={handleConfirmCheckout}
        total={total}
        customerStoreCredit={customers.find(c => c._id === selectedCustomerId)?.storeCreditBalance || 0}
        isProcessing={isCheckingOut}
      />

      <QuickProductModal 
        isOpen={isQuickProductModalOpen}
        onClose={() => setIsQuickProductModalOpen(false)}
        barcode={unknownBarcode}
        onCreated={(newProduct) => {
          setProducts((prev) => [newProduct, ...prev]);
          addToCart(newProduct);
        }}
      />

      <ThermalReceiptModal 
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        receiptData={receiptData}
      />

      {/* Offline Sync Tray Modal */}
      {isSyncTrayOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '12px', maxWidth: '560px', width: '90%', border: '1px solid var(--border-color)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cloud size={20} color="var(--accent-primary)" /> Offline Sync Queue
              </h3>
              <button onClick={() => setIsSyncTrayOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 0, marginBottom: '1rem', lineHeight: '1.4' }}>
              Sales recorded while offline or during intermittent internet connection are secured in local browser storage (IndexedDB). They are automatically queued and synchronized with the backend database.
            </p>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.25rem', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', minHeight: '120px' }}>
              {queuedSales.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  All offline sales are synchronized. Queue is clear!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {queuedSales.map((sale) => (
                    <div key={sale.localId} style={{ background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>TX: {sale.payload?.clientTransactionId || sale.localId}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {new Date(sale.timestamp).toLocaleString()} • {sale.payload?.items?.length || 0} items
                        </div>
                      </div>
                      <span className="badge" style={{ background: 'rgba(255, 171, 0, 0.15)', color: '#FFAB00', border: '1px solid #FFAB00', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                        Pending Sync
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={refreshQueuedSales}
              >
                Refresh Queue
              </button>
              <button
                className="btn btn-primary"
                disabled={queuedSales.length === 0 || syncing || isOffline}
                onClick={syncOfflineSales}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <RefreshCw size={16} className={syncing ? 'spin' : ''} />
                {syncing ? 'Syncing...' : `Sync Pending (${queuedSales.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
