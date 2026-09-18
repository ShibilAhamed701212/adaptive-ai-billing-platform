import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { ApprovalQueueItem } from '@billing/shared';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  User,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ApprovalsPageProps {
  onNavigate?: (path: string) => void;
}

export const ApprovalsPage: React.FC<ApprovalsPageProps> = ({ onNavigate }) => {
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  // Modal State for Approve/Reject
  const [selectedItem, setSelectedItem] = useState<ApprovalQueueItem | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const loadApprovals = async () => {
    try {
      const res = await apiRequest<ApprovalQueueItem[]>(`/approvals?status=${activeTab}`);
      if (res.success && res.data) {
        setItems(res.data);
      }
    } catch (e) {
      console.error('Failed to load approvals', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, [activeTab]);

  const handleProcessAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setIsProcessing(true);
    try {
      const endpoint = actionType === 'approve' ? `/approvals/${selectedItem._id}/approve` : `/approvals/${selectedItem._id}/reject`;
      const res = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({ reviewNotes }),
      });

      if (res.success) {
        if (actionType === 'approve') {
          confetti({ particleCount: 100, spread: 70 });
        }
        setSelectedItem(null);
        setReviewNotes('');
        loadApprovals();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Manager Approval Queue</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
            Review high-value transactions, custom discount thresholds, and rule-triggered approvals
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
        {[
          { id: 'pending', label: 'Pending Review', icon: Clock },
          { id: 'approved', label: 'Approved History', icon: CheckCircle2 },
          { id: 'rejected', label: 'Rejected History', icon: XCircle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="btn btn-sm"
              style={{
                background: isActive ? 'var(--accent-primary)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                border: 'none',
              }}
            >
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Approvals Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Entity / Reason</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Requested By</th>
              <th>Requested Date</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Loading approval items...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  {activeTab === 'pending'
                    ? '🎉 No items pending manager approval! All invoices and rules are up to date.'
                    : `No ${activeTab} items recorded.`}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item._id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {item.reason || `Approval Request for ${item.entityType}`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      Entity ID: #{String(item.entityId).substring(18)}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-draft" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                      {item.entityType}
                    </span>
                  </td>
                  <td className="num-mono" style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    {item.amount ? `₹${item.amount.toLocaleString()}` : '-'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
                      <User size={13} color="var(--text-muted)" />
                      {item.requestedByEmail || 'System'}
                    </div>
                  </td>
                  <td className="num-mono" style={{ fontSize: '0.8rem' }}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <span className={`badge badge-${item.status === 'approved' ? 'paid' : item.status === 'rejected' ? 'overdue' : 'draft'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {item.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: 'var(--color-danger)' }}
                          onClick={() => {
                            setSelectedItem(item);
                            setActionType('reject');
                            setReviewNotes('');
                          }}
                        >
                          <XCircle size={13} /> Reject
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setSelectedItem(item);
                            setActionType('approve');
                            setReviewNotes('Approved based on authorization policy.');
                          }}
                        >
                          <CheckCircle2 size={13} /> Approve
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {item.reviewedByEmail ? `By: ${item.reviewedByEmail}` : 'Completed'}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Approve / Reject Modal */}
      {selectedItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>
                {actionType === 'approve' ? 'Approve Item' : 'Reject Item'}
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedItem(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleProcessAction}>
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8125rem' }}>
                <div><strong>Entity:</strong> {selectedItem.entityType}</div>
                <div><strong>Reason:</strong> {selectedItem.reason}</div>
                {selectedItem.amount && <div><strong>Amount:</strong> ₹{selectedItem.amount.toLocaleString()}</div>}
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Manager Review Notes</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  required
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Enter reason or comments for audit record..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedItem(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn ${actionType === 'approve' ? 'btn-primary' : 'btn-secondary'}`}
                  style={actionType === 'reject' ? { background: 'var(--color-danger)', color: '#ffffff' } : {}}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
