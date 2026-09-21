import React, { useEffect, useState } from 'react';
import { CreditCard, Layers, Plus, RefreshCw, Users } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useToast } from '../../components/common/Toast';

type Section = 'plans' | 'subscriptions';

export const SaaSManagementPage: React.FC<{ section: Section }> = ({ section }) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast();
  const [plan, setPlan] = useState({ name: '', price: '', billingInterval: 'monthly', features: '' });
  const [subscription, setSubscription] = useState({ customerId: '', planId: '', status: 'active', renewalDate: '' });

  const load = async () => {
    setLoading(true); setError('');
    const [plansRes, customersRes, subscriptionsRes] = await Promise.all([
      apiRequest('/saas/plans'), apiRequest('/customers'), apiRequest('/saas/subscriptions'),
    ]);
    if (!plansRes.success || !customersRes.success || !subscriptionsRes.success) {
      setError(plansRes.error?.message || customersRes.error?.message || subscriptionsRes.error?.message || 'Unable to load SaaS data');
    }
    setPlans(plansRes.data || []); setCustomers(customersRes.data || []); setSubscriptions(subscriptionsRes.data || []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const createPlan = async (event: React.FormEvent) => {
    event.preventDefault();
    const res = await apiRequest('/saas/plans', { method: 'POST', body: JSON.stringify({ ...plan, price: Number(plan.price), features: plan.features.split('\n').map((item) => item.trim()).filter(Boolean) }) });
    if (!res.success) return setError(res.error?.message || 'Unable to create plan');
    setPlan({ name: '', price: '', billingInterval: 'monthly', features: '' }); toast.show('Plan created', 'success'); load();
  };
  const createSubscription = async (event: React.FormEvent) => {
    event.preventDefault();
    const res = await apiRequest('/saas/subscriptions', { method: 'POST', body: JSON.stringify({ ...subscription, renewalDate: subscription.renewalDate || undefined }) });
    if (!res.success) return setError(res.error?.message || 'Unable to create subscription');
    setSubscription({ customerId: '', planId: '', status: 'active', renewalDate: '' }); toast.show('Subscription created', 'success'); load();
  };
  const changeStatus = async (record: any, status: string) => {
    const res = await apiRequest(`/saas/subscriptions/${record._id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    if (!res.success) return setError(res.error?.message || 'Subscription cannot be moved to that status');
    toast.show('Subscription status updated', 'success'); load();
  };

  const title = section === 'plans' ? 'Pricing Plans' : 'Subscriptions';
  return <div className="page-container">
    <div className="page-header"><div><h1 className="page-title">{section === 'plans' ? <Layers size={24} /> : <CreditCard size={24} />}<span style={{ marginLeft: '0.5rem' }}>{title}</span></h1><p className="page-subtitle">{section === 'plans' ? 'Define the plans your customers can subscribe to.' : 'Manage customer access, renewal dates, and lifecycle status.'}</p></div><button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={16} /> Refresh</button></div>
    {error && <div role="alert" className="helper-banner" style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>{error}</div>}
    {section === 'plans' ? <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, .85fr) minmax(0, 1.6fr)', gap: '1.5rem' }}>
      <form className="glass-panel" onSubmit={createPlan} style={{ padding: '1.25rem', display: 'grid', gap: '.9rem', alignContent: 'start' }}><h2 style={{ fontSize: '1.05rem' }}><Plus size={17} /> New plan</h2><label className="form-group"><span className="form-label">Plan name</span><input className="form-input" required value={plan.name} onChange={e => setPlan({ ...plan, name: e.target.value })} /></label><label className="form-group"><span className="form-label">Price</span><input className="form-input" type="number" min="0" step="0.01" required value={plan.price} onChange={e => setPlan({ ...plan, price: e.target.value })} /></label><label className="form-group"><span className="form-label">Billing interval</span><select className="form-select" value={plan.billingInterval} onChange={e => setPlan({ ...plan, billingInterval: e.target.value })}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label><label className="form-group"><span className="form-label">Included features</span><textarea className="form-textarea" rows={4} value={plan.features} onChange={e => setPlan({ ...plan, features: e.target.value })} placeholder="One feature per line" /></label><button className="btn btn-primary" type="submit">Create plan</button></form>
      <div className="data-table-container"><table className="data-table"><thead><tr><th>Plan</th><th>Features</th><th>Price</th><th>Interval</th></tr></thead><tbody>{loading ? <tr><td colSpan={4}>Loading plans…</td></tr> : plans.length === 0 ? <tr><td colSpan={4}>No plans yet. Create your first plan.</td></tr> : plans.map(item => <tr key={item._id}><td><strong>{item.name}</strong></td><td>{item.features?.length ? item.features.join(', ') : '—'}</td><td className="num-mono">{Number(item.price).toFixed(2)}</td><td><span className="badge badge-draft">{item.billingInterval}</span></td></tr>)}</tbody></table></div>
    </div> : <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, .85fr) minmax(0, 1.6fr)', gap: '1.5rem' }}>
      <form className="glass-panel" onSubmit={createSubscription} style={{ padding: '1.25rem', display: 'grid', gap: '.9rem', alignContent: 'start' }}><h2 style={{ fontSize: '1.05rem' }}><Users size={17} /> New subscription</h2><label className="form-group"><span className="form-label">Customer</span><select className="form-select" required value={subscription.customerId} onChange={e => setSubscription({ ...subscription, customerId: e.target.value })}><option value="">Select customer</option>{customers.map(customer => <option key={customer._id} value={customer._id}>{customer.name}</option>)}</select></label><label className="form-group"><span className="form-label">Plan</span><select className="form-select" required value={subscription.planId} onChange={e => setSubscription({ ...subscription, planId: e.target.value })}><option value="">Select plan</option>{plans.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label><label className="form-group"><span className="form-label">Initial status</span><select className="form-select" value={subscription.status} onChange={e => setSubscription({ ...subscription, status: e.target.value })}><option value="active">Active</option><option value="trialing">Trial</option></select></label><label className="form-group"><span className="form-label">Renewal date <em>(optional)</em></span><input className="form-input" type="date" value={subscription.renewalDate} onChange={e => setSubscription({ ...subscription, renewalDate: e.target.value })} /></label><button className="btn btn-primary" type="submit" disabled={!plans.length || !customers.length}>Create subscription</button></form>
      <div className="data-table-container"><table className="data-table"><thead><tr><th>Customer</th><th>Plan</th><th>Renews</th><th>Status</th><th>Action</th></tr></thead><tbody>{loading ? <tr><td colSpan={5}>Loading subscriptions…</td></tr> : subscriptions.length === 0 ? <tr><td colSpan={5}>No subscriptions yet.</td></tr> : subscriptions.map(item => <tr key={item._id}><td>{item.customerId?.name || 'Deleted customer'}</td><td>{item.planId?.name || 'Deleted plan'}</td><td>{item.renewalDate ? new Date(item.renewalDate).toLocaleDateString() : '—'}</td><td><span className={`badge badge-${item.status}`}>{item.status}</span></td><td>{item.status === 'trialing' && <button className="btn btn-secondary btn-sm" onClick={() => changeStatus(item, 'active')}>Activate</button>}{item.status === 'active' && <button className="btn btn-secondary btn-sm" onClick={() => changeStatus(item, 'canceled')}>Cancel</button>}{item.status === 'past_due' && <button className="btn btn-secondary btn-sm" onClick={() => changeStatus(item, 'active')}>Restore</button>}</td></tr>)}</tbody></table></div>
    </div>}
  </div>;
};
