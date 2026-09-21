import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    payments: { method: string; amount: number }[],
    tenderDetails: { amountTendered: number; changeGiven: number },
    loyaltyDetails?: { pointsRedeemed: number; discountAmount: number }
  ) => void;
  total: number;
  customerStoreCredit?: number;
  customerLoyaltyPoints?: number;
  isProcessing: boolean;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  total,
  customerStoreCredit = 0,
  customerLoyaltyPoints = 0,
  isProcessing,
}) => {
  const [cash, setCash] = useState<number | ''>(total);
  const [card, setCard] = useState<number | ''>('');
  const [upi, setUpi] = useState<number | ''>('');
  const [storeCredit, setStoreCredit] = useState<number | ''>('');
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | ''>('');
  const [credit, setCredit] = useState<number | ''>('');

  if (!isOpen) return null;

  const getNum = (val: number | '') => Number(val) || 0;
  
  // 1 Loyalty Point = ₹1.00
  const loyaltyRupeeValue = getNum(loyaltyPoints);
  const totalEntered = getNum(cash) + getNum(card) + getNum(upi) + getNum(storeCredit) + loyaltyRupeeValue + getNum(credit);
  const nonCashPayments = getNum(card) + getNum(upi) + getNum(storeCredit) + loyaltyRupeeValue;
  const remaining = Math.max(0, total - totalEntered);
  const change = Math.max(0, getNum(cash) > 0 ? getNum(cash) - Math.max(0, total - nonCashPayments) : 0);

  const handleSubmit = () => {
    if (getNum(storeCredit) > customerStoreCredit) {
      alert(`Store credit entered (₹${getNum(storeCredit)}) exceeds available balance (₹${customerStoreCredit}).`);
      return;
    }

    if (getNum(loyaltyPoints) > customerLoyaltyPoints) {
      alert(`Loyalty points entered (${getNum(loyaltyPoints)} pts) exceeds available balance (${customerLoyaltyPoints} pts).`);
      return;
    }

    if (loyaltyRupeeValue > total) {
      alert(`Loyalty points redemption value (₹${loyaltyRupeeValue}) cannot exceed bill total (₹${total.toFixed(2)}).`);
      return;
    }

    if (totalEntered < total && getNum(credit) === 0) {
      if (!window.confirm(`Total entered is less than the bill amount. The remaining ₹${remaining.toFixed(2)} will be marked as Udhaar (Credit). Continue?`)) {
        return;
      }
    }
    
    const payments = [];
    const cashPortion = getNum(cash) > 0 ? Math.min(getNum(cash), Math.max(0, total - nonCashPayments)) : 0;
    if (cashPortion > 0) payments.push({ method: 'cash', amount: cashPortion });
    if (getNum(card) > 0) payments.push({ method: 'card', amount: getNum(card) });
    if (getNum(upi) > 0) payments.push({ method: 'upi', amount: getNum(upi) });
    if (getNum(storeCredit) > 0) payments.push({ method: 'store_credit', amount: getNum(storeCredit) });
    if (loyaltyRupeeValue > 0) payments.push({ method: 'loyalty_points', amount: loyaltyRupeeValue });
    
    onConfirm(payments, {
      amountTendered: getNum(cash) > 0 ? getNum(cash) : totalPaidCalc(payments),
      changeGiven: change,
    }, {
      pointsRedeemed: getNum(loyaltyPoints),
      discountAmount: loyaltyRupeeValue,
    });
  };

  const totalPaidCalc = (arr: any[]) => arr.reduce((acc, p) => acc + p.amount, 0);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '12px', width: '400px', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>Checkout</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X /></button>
        </div>

        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '2rem' }}>
          Total Due: ₹{total.toFixed(2)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>Cash</label>
            <input type="number" value={cash} onChange={e => setCash(e.target.value ? Number(e.target.value) : '')} style={{ width: '150px', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>Card</label>
            <input type="number" value={card} onChange={e => setCard(e.target.value ? Number(e.target.value) : '')} style={{ width: '150px', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>UPI</label>
            <input type="number" value={upi} onChange={e => setUpi(e.target.value ? Number(e.target.value) : '')} style={{ width: '150px', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
          </div>
          {customerStoreCredit > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block' }}>Store Credit</label>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Avail: ₹{customerStoreCredit}</small>
              </div>
              <input type="number" max={customerStoreCredit} value={storeCredit} onChange={e => setStoreCredit(e.target.value ? Number(e.target.value) : '')} style={{ width: '150px', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
            </div>
          )}
          {customerLoyaltyPoints > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, color: 'var(--accent-primary)' }}>Loyalty Points</label>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Avail: {customerLoyaltyPoints} pts (1 pt = ₹1)
                </small>
              </div>
              <input
                type="number"
                min="0"
                max={Math.min(customerLoyaltyPoints, total)}
                placeholder="0 pts"
                value={loyaltyPoints}
                onChange={e => setLoyaltyPoints(e.target.value ? Math.max(0, parseInt(e.target.value) || 0) : '')}
                style={{ width: '150px', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--accent-primary)' }}
              />
            </div>
          )}
        </div>

        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: remaining > 0 ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
            <span>Remaining Due:</span>
            <span>₹{remaining.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: change > 0 ? 'var(--color-success)' : 'var(--text-secondary)', marginTop: '0.5rem' }}>
            <span>Change to Return:</span>
            <span>₹{change.toFixed(2)}</span>
          </div>
        </div>

          <button 
            onClick={handleSubmit} 
            disabled={isProcessing}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '2rem', padding: '1rem', borderRadius: '8px', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
          >
          {isProcessing ? 'Processing...' : <><Check size={20} /> Complete Sale</>}
        </button>
      </div>
    </div>
  );
};
