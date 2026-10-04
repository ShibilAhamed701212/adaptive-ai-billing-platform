import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api/client';
import { useToast } from '../common/Toast';
import { Building2, ChevronDown, Check, Plus, Loader2, Mail, X } from 'lucide-react';

interface OrganizationSwitcherProps {
  onNavigate: (path: string) => void;
}

export const OrganizationSwitcher: React.FC<OrganizationSwitcherProps> = ({ onNavigate }) => {
  const { organization, memberships, switchOrganization, refreshProfile } = useAuth();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  const handleSwitch = async (orgId: string) => {
    if (orgId === organization?._id) {
      setOpen(false);
      return;
    }
    setSwitchingTo(orgId);
    const res = await switchOrganization(orgId);
    setSwitchingTo(null);
    setOpen(false);
    if (res.success) {
      show('Switched organization', 'success');
    } else {
      show(res.error || 'Unable to switch organization', 'error');
    }
  };

  const handleInvitation = async (membershipId: string, orgName: string, action: 'accept' | 'decline') => {
    setRespondingTo(membershipId);
    const res = await apiRequest(`/organizations/invitations/${membershipId}/${action}`, { method: 'POST' });
    setRespondingTo(null);
    if (res.success) {
      await refreshProfile();
      show(action === 'accept' ? `You joined ${orgName}` : `Invitation from ${orgName} declined`, 'success');
    } else {
      show(res.error?.message || 'Unable to respond to the invitation', 'error');
    }
  };

  const options = memberships.filter((m) => m.status !== 'invited');
  const invitations = memberships.filter((m) => m.status === 'invited');
  const currentLabel = organization?.name || 'Organization';

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.4rem 0.6rem',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          background: '#fff',
        }}
        title="Switch organization"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div
          className="app-hide-sm"
          style={{
            width: '2rem',
            height: '2rem',
            borderRadius: '8px',
            background: 'var(--accent-primary)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Building2 size={17} />
        </div>
        <div style={{ textAlign: 'left', minWidth: 0 }}>
          <div className="org-switcher-name" style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>
            {currentLabel}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Organization</div>
        </div>
        {invitations.length > 0 && (
          <span
            title={`${invitations.length} pending invitation${invitations.length > 1 ? 's' : ''}`}
            style={{ background: 'var(--color-danger)', color: '#fff', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, padding: '0 0.4rem', lineHeight: '1.1rem' }}
          >
            {invitations.length}
          </span>
        )}
        <ChevronDown size={15} color="var(--text-muted)" />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.5rem)',
            left: 0,
            minWidth: 'min(280px, calc(100vw - 2rem))',
            background: '#fff',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.16)',
            padding: '0.4rem',
            zIndex: 200,
          }}
        >
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0.5rem 0.6rem 0.3rem', letterSpacing: '0.04em' }}>
            Your organizations
          </div>

          {options.length === 0 && (
            <div style={{ padding: '0.5rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {currentLabel}
            </div>
          )}

          {options.map((m) => {
            const org = m.organization;
            if (!org) return null;
            const isCurrent = org._id === organization?._id;
            return (
              <button
                key={m._id}
                onClick={() => handleSwitch(org._id)}
                disabled={switchingTo !== null}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.55rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: isCurrent ? '#eef2ff' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <Building2 size={15} color={isCurrent ? 'var(--accent-primary)' : '#94a3b8'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {org.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {m.role} • {m.status}
                  </div>
                </div>
                {switchingTo === org._id ? (
                  <Loader2 size={15} className="animate-spin" color="var(--accent-primary)" />
                ) : (
                  isCurrent && <Check size={15} color="var(--accent-primary)" />
                )}
              </button>
            );
          })}

          {invitations.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.3rem', paddingTop: '0.3rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0.5rem 0.6rem 0.3rem', letterSpacing: '0.04em' }}>
                Pending invitations
              </div>
              {invitations.map((m) => {
                const orgName = m.organization?.name || 'An organization';
                const busy = respondingTo === m._id;
                return (
                  <div key={m._id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.6rem' }}>
                    <Mail size={15} color="var(--accent-primary)" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{orgName}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>Invited as {m.role}</div>
                    </div>
                    {busy ? (
                      <Loader2 size={15} className="animate-spin" color="var(--accent-primary)" />
                    ) : (
                      <>
                        <button className="btn btn-primary btn-sm" disabled={respondingTo !== null} onClick={() => handleInvitation(m._id, orgName, 'accept')} title="Accept invitation">
                          <Check size={13} /> Accept
                        </button>
                        <button className="btn btn-ghost btn-sm" disabled={respondingTo !== null} onClick={() => handleInvitation(m._id, orgName, 'decline')} title="Decline invitation" aria-label={`Decline invitation from ${orgName}`}>
                          <X size={13} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.3rem', paddingTop: '0.3rem' }}>
            <button
              onClick={() => {
                setOpen(false);
                onNavigate('/organizations/new');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                textAlign: 'left',
                padding: '0.55rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--accent-primary)',
                fontWeight: 600,
                fontSize: '0.82rem',
              }}
            >
              <Plus size={15} /> Create organization
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
