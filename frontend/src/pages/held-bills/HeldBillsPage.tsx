import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { PauseCircle, Search, Trash2, Check, Clock, User, AlertCircle, ShoppingCart } from 'lucide-react';
import { usePOSCart } from '../../context/POSCartContext';

export const HeldBillsPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [heldBills, setHeldBills] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { restoreHeldBillToCart } = usePOSCart();

  useEffect(() => {
    fetchHeldBills();
  }, []);

  const fetchHeldBills = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest<any[]>('/pos/held-bills');
      if (res.success && res.data) {
        setHeldBills(res.data);
      } else {
        setError(res.error?.message || 'Failed to load parked bills');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load parked bills');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteBill = async (id: string) => {
    if (!confirm('Are you sure you want to discard this parked bill?')) return;
    const res = await apiRequest(`/pos/held-bills/${id}`, { method: 'DELETE' });
    if (res.success) fetchHeldBills();
  };

  const restoreBill = async (id: string) => {
    setRestoringId(id);
    setError(null);
    try {
      const res = await apiRequest<any>(`/pos/held-bills/${id}/restore`, {
        method: 'POST',
      });

      if (res.success && res.data) {
        restoreHeldBillToCart(res.data);
        onNavigate('/pos');
      } else {
        setError(res.error?.message || 'Failed to restore held bill');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to restore held bill');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title"><PauseCircle size={24} style={{ marginRight: '0.5rem', color: 'var(--accent-primary)' }} /> Held / Parked Bills</h1>
          <p className="page-subtitle">Temporarily suspended transactions waiting to be completed.</p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Time Parked</th>
                <th>Notes</th>
                <th>Items</th>
                <th>Total Value</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>Loading parked bills...</td></tr>
              ) : heldBills.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <PauseCircle size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <p>No parked bills found.</p>
                  </td>
                </tr>
              ) : (
                heldBills.map(bill => {
                  const items = bill.items || bill.cart || [];
                  const total = items.reduce((sum: number, item: any) => sum + ((Number(item.cartQuantity) || 1) * (Number(item.unitPrice) || 0) - (Number(item.lineDiscount) || 0)), 0);
                  return (
                    <tr key={bill._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Clock size={16} color="var(--text-muted)" />
                          {new Date(bill.heldAt || bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(bill.heldAt || bill.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td>
                        <div>{bill.notes || '-'}</div>
                        {bill.customerName && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cust: {bill.customerName}</div>}
                      </td>
                      <td>{items.length} items</td>
                      <td style={{ fontWeight: 600 }}>₹{total.toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => restoreBill(bill._id)} disabled={restoringId === bill._id} style={{ marginRight: '0.5rem' }}>
                          <Check size={16} /> {restoringId === bill._id ? 'Restoring...' : 'Restore'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => deleteBill(bill._id)} style={{ color: 'var(--color-danger)' }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
