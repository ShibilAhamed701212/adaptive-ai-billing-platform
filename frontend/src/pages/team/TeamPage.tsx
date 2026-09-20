import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { UserRole } from '@billing/shared';
import { UserPlus, ShieldCheck, X, Trash2, Mail, RefreshCw } from 'lucide-react';

interface TeamMember {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
}

const ROLES: UserRole[] = ['admin', 'manager', 'accountant', 'sales', 'viewer'];

export const TeamPage: React.FC = () => {
  const { user, memberships } = useAuth();
  const { show } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('sales');

  const load = async () => {
    setLoading(true);
    const res = await apiRequest<TeamMember[]>('/users');
    if (res.success && res.data) {
      setMembers(res.data);
    } else {
      show(res.error?.message || 'Failed to load team members', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });
    setSaving(false);
    if (res.success) {
      show(`${name} was added to the organization`, 'success');
      setIsModalOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      setRole('sales');
      load();
    } else {
      show(res.error?.message || 'Failed to add member', 'error');
    }
  };

  const handleRoleChange = async (member: TeamMember, nextRole: UserRole) => {
    setBusyId(member._id);
    const res = await apiRequest(`/users/${member._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: nextRole }),
    });
    setBusyId(null);
    if (res.success) {
      show(`${member.name} is now ${nextRole}`, 'success');
      setMembers((prev) => prev.map((m) => (m._id === member._id ? { ...m, role: nextRole } : m)));
    } else {
      show(res.error?.message || 'Failed to update role', 'error');
    }
  };

  const handleToggleActive = async (member: TeamMember) => {
    setBusyId(member._id);
    const res = await apiRequest(`/users/${member._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !member.isActive }),
    });
    setBusyId(null);
    if (res.success) {
      show(`${member.name} ${member.isActive ? 'deactivated' : 'reactivated'}`, 'success');
      setMembers((prev) => prev.map((m) => (m._id === member._id ? { ...m, isActive: !member.isActive } : m)));
    } else {
      show(res.error?.message || 'Failed to update member', 'error');
    }
  };

  const myRole = memberships.find((m) => m.organizationId === user?.organizationId)?.role || user?.role;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Team</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
            People who can access this organization. Your role: <strong style={{ textTransform: 'capitalize' }}>{myRole}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={14} /> Refresh</button>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}><UserPlus size={15} /> Add member</button>
        </div>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading team...</td></tr>
            ) : members.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>You are the only member. Add your first team member.</td></tr>
            ) : (
              members.map((m) => (
                <tr key={m._id}>
                  <td style={{ fontWeight: 600 }}>
                    {m.name} {m._id === user?._id && <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)' }}>(you)</span>}
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}><Mail size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />{m.email}</td>
                  <td>
                    <select
                      className="form-select"
                      value={m.role}
                      disabled={busyId === m._id || m._id === user?._id}
                      onChange={(e) => handleRoleChange(m, e.target.value as UserRole)}
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <span className={`badge badge-${m.isActive ? 'paid' : 'draft'}`}>{m.isActive ? 'active' : 'disabled'}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleToggleActive(m)}
                      disabled={busyId === m._id || m._id === user?._id}
                      style={{ color: m.isActive ? 'var(--color-danger)' : 'var(--color-success)' }}
                      title={m.isActive ? 'Deactivate member' : 'Reactivate member'}
                    >
                      <Trash2 size={15} /> {m.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
        <ShieldCheck size={18} color="var(--accent-primary)" style={{ marginTop: '0.1rem' }} />
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          Roles are organization-specific. A user added here gains access only to this organization, and permissions are
          enforced by the backend for every request.
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Add team member</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsModalOpen(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Full name *</label>
                <input className="form-input" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input type="email" className="form-input" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Temporary password *</label>
                <input type="text" className="form-input" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Adding...' : 'Add member'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
