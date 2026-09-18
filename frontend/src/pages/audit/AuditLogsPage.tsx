import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { Shield, Search, Filter, Clock, User, FileText, ChevronDown, ChevronRight } from 'lucide-react';

interface AuditLog {
  _id: string;
  organizationId: string;
  userId?: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityId?: string;
  ipAddress?: string;
  details?: Record<string, any>;
  createdAt: string;
}

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = async () => {
    try {
      const res = await apiRequest<AuditLog[]>('/audit-logs');
      if (res.success && res.data) {
        setLogs(res.data);
      }
    } catch (e) {
      console.error('Failed to load audit logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesAction = selectedAction === 'ALL' || log.action === selectedAction;
    const matchesSearch =
      !searchTerm ||
      log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityType.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesAction && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Compliance & Audit Trail</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
          Immutable record of financial transactions, schema changes, user actions and approvals
        </p>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '240px', background: '#f8fafc', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by user email, action, entity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.85rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={15} color="var(--text-muted)" />
          <select
            className="form-select"
            style={{ width: 'auto', fontSize: '0.8125rem' }}
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
          >
            <option value="ALL">All Actions</option>
            <option value="CREATE_INVOICE">CREATE_INVOICE</option>
            <option value="UPDATE_INVOICE_STATUS">UPDATE_INVOICE_STATUS</option>
            <option value="RECORD_PAYMENT">RECORD_PAYMENT</option>
            <option value="REFUND_PAYMENT">REFUND_PAYMENT</option>
            <option value="CREATE_CREDIT_NOTE">CREATE_CREDIT_NOTE</option>
            <option value="CREATE_RECURRING_PROFILE">CREATE_RECURRING_PROFILE</option>
            <option value="APPROVE_ITEM">APPROVE_ITEM</option>
            <option value="REJECT_ITEM">REJECT_ITEM</option>
            <option value="CREATE_INVOICE_TEMPLATE">CREATE_INVOICE_TEMPLATE</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '30px' }}></th>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Entity</th>
              <th>User</th>
              <th>Entity ID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Loading audit logs...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No audit entries found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedId === log._id;
                return (
                  <React.Fragment key={log._id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : log._id)}
                      style={{ cursor: 'pointer', background: isExpanded ? '#f8fafc' : 'transparent' }}
                    >
                      <td>
                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} color="var(--text-muted)" />}
                      </td>
                      <td className="num-mono" style={{ fontSize: '0.8rem' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <span className="badge badge-draft" style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700 }}>
                          {log.action}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{log.entityType}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
                          <User size={13} color="var(--text-muted)" />
                          {log.userEmail}
                        </div>
                      </td>
                      <td className="num-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {log.entityId ? `#${String(log.entityId).substring(18)}` : '-'}
                      </td>
                    </tr>
                    {isExpanded && log.details && (
                      <tr style={{ background: '#f8fafc' }}>
                        <td></td>
                        <td colSpan={5} style={{ padding: '0.75rem 1.25rem' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                            EVENT PAYLOAD AUDIT DETAILS:
                          </div>
                          <pre
                            style={{
                              background: '#ffffff',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: '6px',
                              padding: '0.75rem',
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              margin: 0,
                              overflowX: 'auto',
                            }}
                          >
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
