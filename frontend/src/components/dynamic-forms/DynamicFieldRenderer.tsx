import React, { useEffect, useState } from 'react';
import { CustomFieldDefinition, TargetEntity } from '@billing/shared';
import { apiRequest } from '../../api/client';
import { Layers, HelpCircle } from 'lucide-react';

interface DynamicFieldRendererProps {
  targetEntity: TargetEntity;
  values: Record<string, any>;
  onChange: (fieldName: string, value: any) => void;
  disabled?: boolean;
}

export const DynamicFieldRenderer: React.FC<DynamicFieldRendererProps> = ({
  targetEntity,
  values,
  onChange,
  disabled = false,
}) => {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function loadFields() {
      try {
        const res = await apiRequest<CustomFieldDefinition[]>(`/dynamic/fields?targetEntity=${targetEntity}`);
        if (res.success && res.data && isMounted) {
          setFields(res.data);
        }
      } catch (e) {
        console.error('Failed to load dynamic fields:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadFields();
    return () => {
      isMounted = false;
    };
  }, [targetEntity]);

  if (loading || fields.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px dashed var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.9rem' }}>
        <Layers size={16} color="var(--accent-secondary)" />
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Configured Model Fields ({fields.length})
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        {fields.map((field) => {
          const val = values[field.fieldName] ?? field.defaultValue ?? '';

          return (
            <div key={field.fieldName} className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>
                  {field.label} {field.required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
                </span>
                {field.placeholder && (
                  <span title={field.placeholder} style={{ cursor: 'help', color: 'var(--text-muted)' }}>
                    <HelpCircle size={12} />
                  </span>
                )}
              </label>

              {field.fieldType === 'select' ? (
                <select
                  className="form-select"
                  value={val}
                  disabled={disabled}
                  onChange={(e) => onChange(field.fieldName, e.target.value)}
                >
                  <option value="">-- Select {field.label} --</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.fieldType === 'boolean' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(val)}
                    disabled={disabled}
                    onChange={(e) => onChange(field.fieldName, e.target.checked)}
                    style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Enable {field.label}</span>
                </div>
              ) : field.fieldType === 'date' ? (
                <input
                  type="date"
                  className="form-input"
                  value={val}
                  disabled={disabled}
                  onChange={(e) => onChange(field.fieldName, e.target.value)}
                />
              ) : field.fieldType === 'number' ? (
                <input
                  type="number"
                  className="form-input"
                  placeholder={field.placeholder || '0'}
                  value={val}
                  disabled={disabled}
                  onChange={(e) => onChange(field.fieldName, parseFloat(e.target.value) || 0)}
                />
              ) : field.fieldType === 'textarea' ? (
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder={field.placeholder || ''}
                  value={val}
                  disabled={disabled}
                  onChange={(e) => onChange(field.fieldName, e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  className="form-input"
                  placeholder={field.placeholder || `Enter ${field.label}...`}
                  value={val}
                  disabled={disabled}
                  onChange={(e) => onChange(field.fieldName, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
