import React, { useState } from 'react';
import { DatabaseBackup, Download, Upload, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { apiRequest } from '../../api/client';

export const BackupPage: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<any | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(null);
    try {
      const res = await apiRequest('/system/backup', { method: 'POST' });
      if (res.success && res.data) {
        const jsonStr = JSON.stringify(res.data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const orgId = res.data.organizationId || 'org';
        const dateStr = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `backup-${orgId}-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const counts = res.data.counts || {};
        setExportSuccess(
          `Backup generated & downloaded! Contained: ${counts.products ?? 0} products, ${counts.customers ?? 0} customers, ${counts.invoices ?? 0} invoices, ${counts.payments ?? 0} payments, ${counts.suppliers ?? 0} suppliers, ${counts.purchases ?? 0} purchases.`
        );
      } else {
        alert('Failed to generate backup: ' + (res.error?.message || 'Unknown error'));
      }
    } catch (e: any) {
      alert('Backup error: ' + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setParseError(null);
    setRestoreResult(null);
    setParsedBackup(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);

        // Support both direct payload and wrapped payload
        const payload = json.data ? json : { data: json };
        if (!payload.data || typeof payload.data !== 'object') {
          throw new Error('Invalid backup file format: missing "data" property.');
        }

        setParsedBackup(payload);
      } catch (err: any) {
        setParseError(`Failed to parse backup JSON: ${err.message}`);
        setParsedBackup(null);
      }
    };
    reader.onerror = () => {
      setParseError('Failed to read file from disk.');
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = async () => {
    if (!parsedBackup) return;
    setIsRestoring(true);
    setShowConfirmModal(false);
    setRestoreResult(null);

    try {
      const res = await apiRequest('/system/restore', {
        method: 'POST',
        body: JSON.stringify({ backup: parsedBackup }),
      });

      if (res.success && res.data) {
        const restored = res.data.restored || {};
        setRestoreResult(
          `System restore completed successfully! Restored ${restored.products ?? 0} products, ${restored.customers ?? 0} customers, and ${restored.suppliers ?? 0} suppliers.`
        );
        setSelectedFile(null);
        setParsedBackup(null);
      } else {
        alert('Restore failed: ' + (res.error?.message || 'Unknown error'));
      }
    } catch (e: any) {
      alert('Restore error: ' + e.message);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <DatabaseBackup size={24} style={{ marginRight: '0.5rem', color: 'var(--accent-primary)' }} />
            System Backup & Restore
          </h1>
          <p className="page-subtitle">Export organization data and restore system state safely.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Export Column */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
            <Download size={20} /> Export Organization Data
          </h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Generate a full snapshot of all your organization data, including products, customers, invoices, payments, suppliers, and purchase orders.
          </p>

          <ul style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            <li>Format: Standard JSON Document with cryptographic timestamps</li>
            <li>Scope: Tenant-isolated (your organization only)</li>
            <li>Requires Admin / Manager privileges</li>
          </ul>

          {exportSuccess && (
            <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid #22c55e', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.85rem' }}>
              <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{exportSuccess}</div>
            </div>
          )}

          <div style={{ marginTop: 'auto' }}>
            <button
              className="btn btn-primary"
              onClick={handleExport}
              disabled={isExporting}
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
            >
              {isExporting ? 'Generating JSON Backup...' : 'Generate & Download Backup'}
            </button>
          </div>
        </div>

        {/* Restore Column */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
            <Upload size={20} /> Restore Organization Data
          </h3>

          <div
            style={{
              background: 'rgba(255, 171, 0, 0.1)',
              color: '#FFAB00',
              border: '1px solid #FFAB00',
              display: 'flex',
              gap: '0.5rem',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
            }}
          >
            <AlertTriangle size={24} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
              <strong>Warning:</strong> Restoring a backup will upsert records into your organization data. Make sure you are restoring an authorized JSON backup.
            </div>
          </div>

          <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block', color: 'var(--text-secondary)' }}>
            Select Backup File (.json)
          </label>
          <input
            type="file"
            accept=".json,application/json"
            className="form-input"
            onChange={handleFileChange}
            style={{ marginBottom: '1rem', padding: '0.5rem' }}
          />

          {parseError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
              {parseError}
            </div>
          )}

          {parsedBackup && (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                <FileText size={16} color="var(--accent-primary)" />
                Backup Content Detected:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div>Products: <strong>{parsedBackup.data?.products?.length || parsedBackup.counts?.products || 0}</strong></div>
                <div>Customers: <strong>{parsedBackup.data?.customers?.length || parsedBackup.counts?.customers || 0}</strong></div>
                <div>Suppliers: <strong>{parsedBackup.data?.suppliers?.length || parsedBackup.counts?.suppliers || 0}</strong></div>
              </div>
            </div>
          )}

          {restoreResult && (
            <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid #22c55e', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.85rem' }}>
              <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{restoreResult}</div>
            </div>
          )}

          <div style={{ marginTop: 'auto' }}>
            <button
              className="btn btn-secondary"
              disabled={!parsedBackup || isRestoring}
              onClick={() => setShowConfirmModal(true)}
              style={{
                width: '100%',
                justifyContent: 'center',
                color: 'var(--color-danger)',
                borderColor: 'var(--color-danger)',
                padding: '0.75rem',
              }}
            >
              {isRestoring ? 'Restoring System Data...' : 'Verify & Restore Backup'}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '12px', maxWidth: '450px', width: '90%', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#ef4444', marginBottom: '1rem' }}>
              <AlertTriangle size={28} />
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Confirm System Restore</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
              Are you sure you want to restore this backup? This operation will upsert product, customer, and supplier records into your organization. Existing records with identical SKUs or emails will be overwritten.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)', color: '#fff' }}
                onClick={handleConfirmRestore}
              >
                Yes, Restore Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
