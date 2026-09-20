import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '@billing/shared';

export interface CartItem extends Product {
  cartQuantity: number;
  lineDiscount?: number;
}

interface POSCartContextType {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  billDiscount: number;
  setBillDiscount: (d: number) => void;
  addToCart: (product: Product, qty?: number) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  updateLineDiscount: (id: string, discount: number) => void;
  clearCart: () => void;
  restoreHeldBillToCart: (heldBill: any) => void;
  subtotal: number;
  totalDiscount: number;
  tax: number;
  total: number;
}

const POSCartContext = createContext<POSCartContextType | undefined>(undefined);

export const POSCartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = sessionStorage.getItem('pos_active_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(() => {
    return sessionStorage.getItem('pos_selected_customer') || '';
  });

  const [billDiscount, setBillDiscount] = useState<number>(() => {
    const saved = sessionStorage.getItem('pos_bill_discount');
    return saved ? Number(saved) : 0;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('pos_active_cart', JSON.stringify(cart));
      sessionStorage.setItem('pos_selected_customer', selectedCustomerId);
      sessionStorage.setItem('pos_bill_discount', String(billDiscount));
    } catch (e) {
      console.error('Failed to sync POS cart to sessionStorage:', e);
    }
  }, [cart, selectedCustomerId, billDiscount]);

  const addToCart = (product: Product, qty: number = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item._id === product._id);
      if (existing) {
        const newQty = existing.cartQuantity + qty;
        if (product.manageInventory && newQty > (product.stockQuantity || 0)) {
          alert(`Stock limit reached! Max available is ${product.stockQuantity || 0}`);
          return prev;
        }
        return prev.map((item) =>
          item._id === product._id ? { ...item, cartQuantity: newQty } : item
        );
      } else {
        if (product.manageInventory && qty > (product.stockQuantity || 0)) {
          alert(`Product out of stock or requested qty exceeds available stock (${product.stockQuantity || 0})`);
          return prev;
        }
        return [...prev, { ...product, cartQuantity: qty, lineDiscount: 0 }];
      }
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
    setCart((prev) =>
      prev.map((item) => {
        if (item._id === id) {
          if (item.manageInventory && qty > (item.stockQuantity || 0)) {
            alert(`Stock limit reached! Max available is ${item.stockQuantity || 0}.`);
            return { ...item, cartQuantity: item.stockQuantity || 1 };
          }
          return { ...item, cartQuantity: qty };
        }
        return item;
      })
    );
  };

  const updateLineDiscount = (id: string, discount: number) => {
    setCart((prev) =>
      prev.map((item) => (item._id === id ? { ...item, lineDiscount: Math.max(0, discount) } : item))
    );
  };

  const clearCart = () => {
    setCart([]);
    setBillDiscount(0);
    sessionStorage.removeItem('pos_active_cart');
    sessionStorage.removeItem('pos_bill_discount');
  };

  const restoreHeldBillToCart = (heldBill: any) => {
    if (!heldBill || !heldBill.items) return;
    const restoredItems: CartItem[] = heldBill.items.map((item: any) => ({
      _id: String(item.productId || item._id),
      sku: item.sku || '',
      name: item.name,
      description: item.name,
      type: 'goods',
      unit: 'item',
      unitPrice: Number(item.unitPrice) || 0,
      taxRate: Number(item.taxRate) || 0,
      cartQuantity: Number(item.cartQuantity) || 1,
      lineDiscount: Number(item.lineDiscount) || 0,
      stockQuantity: item.stockQuantity,
      barcode: item.barcode,
      isActive: true,
      manageInventory: item.stockQuantity !== undefined,
    } as CartItem));

    setCart(restoredItems);
    if (heldBill.customerId) {
      setSelectedCustomerId(String(heldBill.customerId));
    }
  };

  const subtotal = cart.reduce((sum, item) => {
    const lineTotal = item.unitPrice * item.cartQuantity - (item.lineDiscount || 0);
    return sum + Math.max(0, lineTotal);
  }, 0);
  const totalLineDiscounts = cart.reduce((sum, item) => sum + (item.lineDiscount || 0), 0);
  const totalDiscount = totalLineDiscounts + billDiscount;
  const taxableBase = Math.max(0, subtotal - billDiscount);
  const tax = cart.reduce((sum, item) => {
    const lineNet = Math.max(0, item.unitPrice * item.cartQuantity - (item.lineDiscount || 0));
    return sum + lineNet * item.taxRate;
  }, 0);
  const total = taxableBase + tax;

  return (
    <POSCartContext.Provider
      value={{
        cart,
        setCart,
        selectedCustomerId,
        setSelectedCustomerId,
        billDiscount,
        setBillDiscount,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateLineDiscount,
        clearCart,
        restoreHeldBillToCart,
        subtotal,
        totalDiscount,
        tax,
        total,
      }}
    >
      {children}
    </POSCartContext.Provider>
  );
};

export const usePOSCart = () => {
  const context = useContext(POSCartContext);
  if (!context) {
    throw new Error('usePOSCart must be used within a POSCartProvider');
  }
  return context;
};
