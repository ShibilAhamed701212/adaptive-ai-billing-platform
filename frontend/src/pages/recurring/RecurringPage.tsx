import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { RecurringProfile, Customer, Product } from '@billing/shared';
import {
  Repeat,
  Plus,
  Play,
  Pause,
  Zap,
  Calendar,
  CheckCircle,
  AlertCircle,
  X,
  Trash2,
  Clock,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface RecurringPageProps {
  onNavigate?: (path: string) => void;
}

export const RecurringPage: React.FC<RecurringPageProps> = ({ onNavigate }) => {
  const [profiles, setProfiles] = useState<RecurringProfile[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [profileName, setProfileName] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [autoSend, setAutoSend] = useState<boolean>(true);
  const [items, setItems] = useState<
    {
      description: string;
      unit: string;
      quantity: number;
      unitPrice: number;
      taxRate: number;
    }[]
  >([
    {
      description: 'Monthly SaaS Retainer Subscription',
      unit: 'month',
      quantity: 1,
      unitPrice: 25000,
      taxRate: 0.18,
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [profRes, custRes, prodRes] = await Promise.all([
        apiRequest<RecurringProfile[]>('/recurring'),
        apiRequest<Customer[]>('/customers'),
        apiRequest<Product[]>('/products'),
      ]);

      if (profRes.success && profRes.data) setProfiles(profRes.data);
      if (custRes.success && custRes.data) setCustomers(custRes.data);
      if (prodRes.success && prodRes.data) setProducts(prodRes.data);
    } catch (e) {
      console.error('Error loading recurring profiles', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !profileName || items.length === 0) return;

    setIsSubmitting(true);
    try {
      const res = await apiRequest<RecurringProfile>('/recurring', {
        method: 'POST',
        body: JSON.stringify({
          customerId: selectedCustomerId,
          profileName,
          frequency,
          startDate,
          autoSend,
          items,
        }),
      });

      if (res.success) {
        confetti({ particleCount: 90, spread: 60 });
        setIsModalOpen(false);
        setProfileName('');
        setSelectedCustomerId('');
        loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriggerManualRun = async (profileId: string) => {
    setTriggeringId(profileId);
    try {
      const res = await apiRequest<any>(`/recurring/${profileId}/run`, {
        method: 'POST',
      });

      if (res.success && res.data) {
        confetti({ particleCount: 100, spread: 70 });
        loadData();
        const invoiceId = res.data._id || res.data.invoice?._id;
        if (onNavigate && invoiceId) {
          onNavigate(`/invoices/${invoiceId}`);
        }
      }
    } catch (err) {
      console.error('Failed to trigger recurring generation', err);
    } finally {
      setTriggeringId(null);
    }
  };


  const handleToggleStatus = async (profile: RecurringProfile) => {
    const nextStatus = profile.status === 'active' ? 'paused' : 'active';
    try {
      const res = await apiRequest(`/recurring/${profile._id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.success) {
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        description: '',
        unit: 'unit',
        quantity: 1,
        unitPrice: 0,
        taxRate: 0.18,
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const activeCount = profiles.filter((p) => p.status === 'active').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Recurring Billing & Subscriptions</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
            Automate periodic invoicing, retainer contracts & subscription schedules
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={15} /> Create Recurring Profile
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Active Profiles</span>
            <Repeat size={18} color="var(--accent-primary)" />
          </div>
          <div className="kpi-value">{activeCount}</div>
          <div className="kpi-desc">Scheduled automation cycles</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Paused Schedules</span>
            <Pause size={18} color="var(--color-warning)" />
          </div>
          <div className="kpi-value">{profiles.length - activeCount}</div>
          <div className="kpi-desc">Temporarily halted</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Autonomous Engine</span>
            <Zap size={18} color="var(--color-success)" />
          </div>
          <div className="kpi-value" style={{ fontSize: '1.25rem', color: 'var(--color-success)' }}>
            ONLINE
          </div>
          <div className="kpi-desc">CRON scheduler ready</div>
        </div>
      </div>

      {/* Profile List */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Profile Name</th>
              <th>Customer</th>
              <th>Cadence</th>
              <th>Next Run Date</th>
              <th>Cycle Amount</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Loading recurring schedules...
                </td>
              </tr>
            ) : profiles.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No recurring profiles configured. Create one to automate your subscriptions.
                </td>
              </tr>
            ) : (
              profiles.map((p) => {
                const totalCycleAmount = p.items?.reduce(
                  (sum, it) => sum + (it.quantity * it.unitPrice) * (1 + (it.taxRate || 0)),
                  0
                ) || 0;

                const custName = typeof p.customerId === 'object' && p.customerId ? p.customerId.name || p.customerId.companyName : 'Customer Account';

                return (
                  <tr key={p._id}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.profileName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {p.items?.length || 0} line item(s) • Auto-send: {p.autoSend ? 'YES' : 'NO'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{custName}</div>
                    </td>
                    <td>
                      <span className="badge badge-draft" style={{ textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 700 }}>
                        {p.frequency}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        <Clock size={13} color="var(--text-muted)" />
                        {new Date(p.nextRunDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="num-mono" style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-primary)' }}>
                      ₹{Math.round(totalCycleAmount).toLocaleString()}
                    </td>
                    <td>
                      <span className={`badge badge-${p.status === 'active' ? 'paid' : 'draft'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleTriggerManualRun(p._id)}
                          disabled={triggeringId === p._id}
                          title="Generate Invoice Now"
                        >
                          <Zap size={13} /> {triggeringId === p._id ? 'Generating...' : 'Trigger Now'}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleToggleStatus(p)}
                          title={p.status === 'active' ? 'Pause Profile' : 'Resume Profile'}
                        >
                          {p.status === 'active' ? <Pause size={14} color="var(--color-warning)" /> : <Play size={14} color="var(--color-success)" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Recurring Profile Modal */}
      {isModalOpen && (
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
          <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Create Recurring Profile</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Profile / Subscription Name *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Monthly Enterprise Retainer - Alpha"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Client Account *</label>
                  <select
                    className="form-select"
                    required
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} {c.companyName ? `(${c.companyName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Billing Cadence *</label>
                  <select
                    className="form-select"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Annual (Yearly)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ justifyContent: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', marginTop: '1.25rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={autoSend}
                      onChange={(e) => setAutoSend(e.target.checked)}
                    />
                    Auto-issue and send to customer
                  </label>
                </div>
              </div>

              {/* Items Builder */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="form-label">Recurring Line Items</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addItemRow}>
                    <Plus size={13} /> Add Item
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {items.map((it, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '0.5rem', background: '#f8fafc', padding: '0.65rem', borderRadius: '6px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Item description"
                        value={it.description}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].description = e.target.value;
                          setItems(updated);
                        }}
                      />
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Qty"
                        value={it.quantity}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].quantity = parseFloat(e.target.value) || 1;
                          setItems(updated);
                        }}
                      />
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Rate"
                        value={it.unitPrice}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].unitPrice = parseFloat(e.target.value) || 0;
                          setItems(updated);
                        }}
                      />
                      <select
                        className="form-select"
                        value={it.taxRate}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].taxRate = parseFloat(e.target.value);
                          setItems(updated);
                        }}
                      >
                        <option value="0">0%</option>
                        <option value="0.05">5%</option>
                        <option value="0.12">12%</option>
                        <option value="0.18">18%</option>
                        <option value="0.28">28%</option>
                      </select>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-danger)' }}
                        onClick={() => removeItemRow(idx)}
                        disabled={items.length === 1}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Recurring Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
