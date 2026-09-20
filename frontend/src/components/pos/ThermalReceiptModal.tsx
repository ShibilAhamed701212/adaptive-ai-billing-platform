import React, { useRef } from 'react';
import { Printer, X, Check } from 'lucide-react';
import { defaultPrinter } from '../../hardware/ReceiptPrinter';

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: {
    storeName: string;
    storeAddress?: string;
    gstin?: string;
    invoiceNumber: string;
    date: string;
    customerName?: string;
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      discountAmount?: number;
      lineTotal: number;
    }>;
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    grandTotal: number;
    amountTendered: number;
    changeGiven: number;
    payments: Array<{ method: string; amount: number }>;
    loyaltyPointsRedeemed?: number;
    customerRemainingPoints?: number;
  } | null;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({ isOpen, onClose, receiptData }) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !receiptData) return null;

  const handlePrint = async () => {
    await defaultPrinter.printReceipt();
    await defaultPrinter.openCashDrawer();
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', width: '380px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        
        {/* Header toolbar (Hidden during print) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Printer size={18} /> Receipt Preview (80mm)
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Receipt Paper */}
        <div ref={receiptRef} style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, fontFamily: 'monospace', fontSize: '12px', color: '#000', background: '#fff' }}>
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase' }}>{receiptData.storeName}</h2>
            {receiptData.storeAddress && <p style={{ margin: '0.2rem 0' }}>{receiptData.storeAddress}</p>}
            {receiptData.gstin && <p style={{ margin: '0.2rem 0' }}>GSTIN: {receiptData.gstin}</p>}
            <p style={{ margin: '0.4rem 0', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '0.3rem 0' }}>
              TAX INVOICE / RETAIL RECEIPT
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '11px' }}>
            <span>Bill: {receiptData.invoiceNumber}</span>
            <span>{receiptData.date}</span>
          </div>
          {receiptData.customerName && (
            <div style={{ marginBottom: '0.5rem', fontSize: '11px' }}>
              Customer: {receiptData.customerName}
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.75rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000', textAlign: 'left' }}>
                <th style={{ padding: '4px 0' }}>Item</th>
                <th style={{ padding: '4px 0', textAlign: 'center' }}>Qty</th>
                <th style={{ padding: '4px 0', textAlign: 'right' }}>Price</th>
                <th style={{ padding: '4px 0', textAlign: 'right' }}>Amt</th>
              </tr>
            </thead>
            <tbody>
              {receiptData.items.map((it, idx) => (
                <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                  <td style={{ padding: '4px 0' }}>{it.name}</td>
                  <td style={{ padding: '4px 0', textAlign: 'center' }}>{it.quantity}</td>
                  <td style={{ padding: '4px 0', textAlign: 'right' }}>{it.unitPrice.toFixed(2)}</td>
                  <td style={{ padding: '4px 0', textAlign: 'right' }}>{it.lineTotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderTop: '1px solid #000', paddingTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal:</span>
              <span>₹{receiptData.subtotal.toFixed(2)}</span>
            </div>
            {receiptData.discountTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Discount:</span>
                <span>-₹{receiptData.discountTotal.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Tax (GST):</span>
              <span>₹{receiptData.taxTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '0.3rem 0', margin: '0.2rem 0' }}>
              <span>TOTAL DUE:</span>
              <span>₹{receiptData.grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ marginTop: '0.5rem', fontSize: '11px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Payments:</div>
            {receiptData.payments.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{p.method.toUpperCase()}:</span>
                <span>₹{p.amount.toFixed(2)}</span>
              </div>
            ))}
            {receiptData.amountTendered > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <span>Amount Tendered:</span>
                  <span>₹{receiptData.amountTendered.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Change Returned:</span>
                  <span>₹{receiptData.changeGiven.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          {((receiptData.loyaltyPointsRedeemed && receiptData.loyaltyPointsRedeemed > 0) || receiptData.customerRemainingPoints !== undefined) && (
            <div style={{ marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px dotted #000', fontSize: '11px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.2rem' }}>Loyalty Rewards:</div>
              {receiptData.loyaltyPointsRedeemed ? (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Points Redeemed:</span>
                  <span>{receiptData.loyaltyPointsRedeemed} pts (-₹{receiptData.loyaltyPointsRedeemed.toFixed(2)})</span>
                </div>
              ) : null}
              {receiptData.customerRemainingPoints !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Remaining Balance:</span>
                  <span>{receiptData.customerRemainingPoints} pts</span>
                </div>
              )}
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '1.25rem', borderTop: '1px dashed #000', paddingTop: '0.75rem' }}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>THANK YOU FOR YOUR VISIT!</p>
            <p style={{ margin: '0.2rem 0', fontSize: '10px' }}>Goods once sold can be returned within 7 days.</p>
          </div>
        </div>

        {/* Footer actions (Hidden during print) */}
        <div className="no-print" style={{ display: 'flex', gap: '0.75rem', padding: '1rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer' }}>
            Close
          </button>
          <button onClick={handlePrint} style={{ flex: 2, padding: '0.75rem', borderRadius: '6px', border: 'none', background: 'var(--primary-color)', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <Printer size={18} /> Print Thermal Receipt
          </button>
        </div>

      </div>
    </div>
  );
};
