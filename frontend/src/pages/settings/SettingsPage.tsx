import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api/client';
import { CustomFieldDefinition, BusinessRule, TargetEntity, CustomFieldType } from '@billing/shared';
import { Sliders, Plus, Trash2, Layers, Cpu, Building2, CheckCircle2, Palette } from 'lucide-react';
import { InvoiceTemplateCustomizer } from '../../components/invoices/InvoiceTemplateCustomizer';

export const SettingsPage: React.FC = () => {
  const { organization, updateOrganization } = useAuth();
  const [activeTab, setActiveTab] = useState<'fields' | 'rules' | 'org' | 'templates'>('fields');


  // Custom Fields State
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [fieldEntity, setFieldEntity] = useState<TargetEntity>('invoice');
  const [fieldName, setFieldName] = useState<string>('');
  const [fieldLabel, setFieldLabel] = useState<string>('');
  const [fieldType, setFieldType] = useState<CustomFieldType>('text');
  const [fieldRequired, setFieldRequired] = useState<boolean>(false);
  const [fieldOptions, setFieldOptions] = useState<string>('');
  const [isAddingField, setIsAddingField] = useState<boolean>(false);

  // Business Rules State
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [ruleName, setRuleName] = useState<string>('');
  const [ruleEvent, setRuleEvent] = useState<any>('beforeInvoiceCalculate');
  const [ruleField, setRuleField] = useState<string>('invoiceSubtotal');
  const [ruleOperator, setRuleOperator] = useState<any>('greater_than');
  const [ruleValue, setRuleValue] = useState<string>('50000');
  const [ruleActionType, setRuleActionType] = useState<any>('apply_discount');
  const [ruleActionValue, setRuleActionValue] = useState<string>('5');
  const [isAddingRule, setIsAddingRule] = useState<boolean>(false);

  // Org Settings State
  const [invoicePrefix, setInvoicePrefix] = useState<string>(organization?.settings?.invoicePrefix || 'INV');
  const [taxSystem, setTaxSystem] = useState<string>(organization?.settings?.taxSystem || 'GST');
  const [paymentTermsDays, setPaymentTermsDays] = useState<number>(organization?.settings?.paymentTermsDays || 30);
  const [isSavingOrg, setIsSavingOrg] = useState<boolean>(false);
  const [orgSuccess, setOrgSuccess] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const [fieldsRes, rulesRes] = await Promise.all([
        apiRequest<CustomFieldDefinition[]>('/dynamic/fields'),
        apiRequest<BusinessRule[]>('/dynamic/rules'),
      ]);
      if (fieldsRes.success && fieldsRes.data) setCustomFields(fieldsRes.data);
      if (rulesRes.success && rulesRes.data) setRules(rulesRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingField(true);
    try {
      const optionsArray = fieldOptions ? fieldOptions.split(',').map((s) => s.trim()) : [];
      const res = await apiRequest('/dynamic/fields', {
        method: 'POST',
        body: JSON.stringify({
          targetEntity: fieldEntity,
          fieldName,
          label: fieldLabel,
          fieldType,
          required: fieldRequired,
          options: optionsArray,
        }),
      });
      if (res.success) {
        setFieldName('');
        setFieldLabel('');
        setFieldOptions('');
        loadData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAddingField(false);
    }
  };

  const handleDeleteField = async (id?: string) => {
    if (!id) return;
    try {
      await apiRequest(`/dynamic/fields/${id}`, { method: 'DELETE' });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingRule(true);
    try {
      const res = await apiRequest('/dynamic/rules', {
        method: 'POST',
        body: JSON.stringify({
          ruleName,
          event: ruleEvent,
          condition: {
            field: ruleField,
            operator: ruleOperator,
            value: isNaN(Number(ruleValue)) ? ruleValue : Number(ruleValue),
          },
          action: {
            type: ruleActionType,
            value: isNaN(Number(ruleActionValue)) ? ruleActionValue : Number(ruleActionValue),
            message: `Applied ${ruleName}`,
          },
        }),
      });
      if (res.success) {
        setRuleName('');
        loadData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAddingRule(false);
    }
  };

  const handleDeleteRule = async (id?: string) => {
    if (!id) return;
    try {
      await apiRequest(`/dynamic/rules/${id}`, { method: 'DELETE' });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveOrgSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingOrg(true);
    setOrgSuccess(false);

    try {
      const res = await apiRequest('/organizations/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          settings: {
            ...organization?.settings,
            invoicePrefix,
            taxSystem,
            paymentTermsDays: Number(paymentTermsDays),
          },
        }),
      });
      if (res.success && res.data) {
        updateOrganization(res.data);
        setOrgSuccess(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingOrg(false);
    }
  };

  return (
    <div style={{ maxWidth: '1150px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Dynamic Metadata & Rules Engine</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
          Configure custom schema attributes, declarative pricing rules, and tenant preferences without code modifications.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn ${activeTab === 'fields' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('fields')}
        >
          <Layers size={15} /> Custom Metadata Fields ({customFields.length})
        </button>
        <button
          className={`btn ${activeTab === 'rules' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('rules')}
        >
          <Cpu size={15} /> Business Rules Engine ({rules.length})
        </button>
        <button
          className={`btn ${activeTab === 'org' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('org')}
        >
          <Building2 size={15} /> Tenant & Tax Preferences
        </button>
        <button
          className={`btn ${activeTab === 'templates' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('templates')}
        >
          <Palette size={15} /> Custom Invoice Studio
        </button>
      </div>

      {/* Tab 1: Custom Field Definitions */}
      {activeTab === 'fields' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '1.5rem' }}>
          {/* Add Field Form */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem' }}>Define Custom Field</h3>
            <p className="section-lead">Adds dynamic attributes into MongoDB documents.</p>

            <form onSubmit={handleCreateField} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Target Entity</label>
                <select className="form-select" value={fieldEntity} onChange={(e) => setFieldEntity(e.target.value as TargetEntity)}>
                  <option value="invoice">Invoice Document</option>
                  <option value="customer">Customer Profile</option>
                  <option value="product">Product / Catalog</option>
                  <option value="payment">Payment Record</option>
                </select>
                <span className="element-desc">Where this input field will appear</span>
              </div>

              <div className="form-group">
                <label className="form-label">Internal Field Key *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. projectCode, vehicleNo"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                />
                <span className="element-desc">JSON key identifier (no spaces)</span>
              </div>

              <div className="form-group">
                <label className="form-label">Display Label *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Project Code"
                  value={fieldLabel}
                  onChange={(e) => setFieldLabel(e.target.value)}
                />
                <span className="element-desc">Human-readable label in UI</span>
              </div>

              <div className="form-group">
                <label className="form-label">Data Type</label>
                <select className="form-select" value={fieldType} onChange={(e) => setFieldType(e.target.value as CustomFieldType)}>
                  <option value="text">Text (String)</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="select">Dropdown (Select)</option>
                  <option value="boolean">Toggle (Boolean)</option>
                  <option value="textarea">Multi-line Text</option>
                </select>
                <span className="element-desc">Validation & UI widget renderer</span>
              </div>

              {fieldType === 'select' && (
                <div className="form-group">
                  <label className="form-label">Options (comma separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Monthly, Quarterly, Annual"
                    value={fieldOptions}
                    onChange={(e) => setFieldOptions(e.target.value)}
                  />
                  <span className="element-desc">Selectable menu choices</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
                <input
                  type="checkbox"
                  id="mandatoryToggle"
                  checked={fieldRequired}
                  onChange={(e) => setFieldRequired(e.target.checked)}
                  style={{ width: '1rem', height: '1rem', accentColor: 'var(--accent-primary)' }}
                />
                <label htmlFor="mandatoryToggle" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Mandatory Required Field
                </label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={isAddingField}>
                <Plus size={16} /> Register Dynamic Field
              </button>
            </form>
          </div>

          {/* Fields List */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem' }}>Active Configured Fields ({customFields.length})</h3>
            <p className="section-lead">Live schema definitions dynamically attached to your workspace.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {customFields.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No custom fields defined yet.
                </div>
              ) : (
                customFields.map((field) => (
                  <div
                    key={field._id || field.fieldName}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {field.label} {field.required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Key: <code style={{ color: 'var(--accent-primary)' }}>{field.fieldName}</code> • Entity:{' '}
                        <strong>{field.targetEntity}</strong> • Type: <code>{field.fieldType}</code>
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-danger)' }}
                      onClick={() => handleDeleteField(field._id)}
                      title="Delete Field"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Declarative Business Rules */}
      {activeTab === 'rules' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '1.5rem' }}>
          {/* Rule Builder Form */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem' }}>Add Business Rule</h3>
            <p className="section-lead">Automates discounts, surcharges, and approval workflows.</p>

            <form onSubmit={handleCreateRule} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Rule Title *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Enterprise Volume Discount"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                />
                <span className="element-desc">Descriptive name displayed on invoice breakdowns</span>
              </div>

              <div className="form-group">
                <label className="form-label">Trigger Lifecycle Event</label>
                <select className="form-select" value={ruleEvent} onChange={(e) => setRuleEvent(e.target.value)}>
                  <option value="beforeInvoiceCalculate">Before Invoice Calculation (Pricing/Discounts)</option>
                  <option value="onInvoiceCreate">On Invoice Creation (Approvals/Audits)</option>
                  <option value="onPaymentReceive">On Payment Recorded</option>
                </select>
                <span className="element-desc">Execution hook in billing lifecycle</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Context Field</label>
                  <select className="form-select" value={ruleField} onChange={(e) => setRuleField(e.target.value)}>
                    <option value="invoiceSubtotal">Invoice Subtotal</option>
                    <option value="itemCount">Line Item Count</option>
                    <option value="customerState">Customer State</option>
                  </select>
                  <span className="element-desc">Evaluated field</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Condition</label>
                  <select className="form-select" value={ruleOperator} onChange={(e) => setRuleOperator(e.target.value)}>
                    <option value="greater_than">&gt; Greater than</option>
                    <option value="less_than">&lt; Less than</option>
                    <option value="equals">== Equals</option>
                  </select>
                  <span className="element-desc">Operator</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Value</label>
                  <input
                    type="text"
                    className="form-input"
                    value={ruleValue}
                    onChange={(e) => setRuleValue(e.target.value)}
                  />
                  <span className="element-desc">Threshold</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Action to Apply</label>
                  <select className="form-select" value={ruleActionType} onChange={(e) => setRuleActionType(e.target.value)}>
                    <option value="apply_discount">Apply Discount (%)</option>
                    <option value="add_surcharge">Add Surcharge (₹)</option>
                    <option value="require_approval">Require Manager Approval</option>
                  </select>
                  <span className="element-desc">Automatic outcome</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Action Value</label>
                  <input
                    type="text"
                    className="form-input"
                    value={ruleActionValue}
                    onChange={(e) => setRuleActionValue(e.target.value)}
                  />
                  <span className="element-desc">Amount or %</span>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={isAddingRule}>
                <Plus size={16} /> Deploy Rule
              </button>
            </form>
          </div>

          {/* Rules List */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem' }}>Active Declarative Rules ({rules.length})</h3>
            <p className="section-lead">Executed deterministically on every billing calculation request.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {rules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No active business rules.
                </div>
              ) : (
                rules.map((rule) => (
                  <div
                    key={rule._id || rule.ruleName}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rule.ruleName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        If <code>{rule.condition.field}</code> {rule.condition.operator}{' '}
                        <strong>{JSON.stringify(rule.condition.value)}</strong> &rarr; Action:{' '}
                        <strong style={{ color: 'var(--accent-primary)' }}>{rule.action.type}</strong> (
                        {JSON.stringify(rule.action.value)})
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-danger)' }}
                      onClick={() => handleDeleteRule(rule._id)}
                      title="Delete Rule"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Organization & Tax Preferences */}
      {activeTab === 'org' && (
        <div className="glass-panel" style={{ padding: '2rem', maxWidth: '650px' }}>
          <h3 style={{ fontSize: '1.15rem', margin: '0 0 0.25rem' }}>Tenant Billing & Tax System</h3>
          <p className="section-lead">Global defaults applied to all issued invoices and statutory tax schedules.</p>

          {orgSuccess && (
            <div
              style={{
                background: 'var(--color-success-bg)',
                border: '1px solid #bbf7d0',
                color: 'var(--color-success)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                marginBottom: '1rem',
                fontWeight: 600,
              }}
            >
              Organization settings updated successfully.
            </div>
          )}

          <form onSubmit={handleSaveOrgSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Invoice Number Prefix</label>
              <input
                type="text"
                className="form-input"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                placeholder="INV"
              />
              <span className="element-desc">Pre-pended to all sequential invoice numbers (e.g. INV-2026-1001)</span>
            </div>

            <div className="form-group">
              <label className="form-label">Default Statutory Tax System</label>
              <select className="form-select" value={taxSystem} onChange={(e) => setTaxSystem(e.target.value)}>
                <option value="GST">GST (India - CGST/SGST/IGST)</option>
                <option value="VAT">VAT (Value Added Tax)</option>
                <option value="SALES_TAX">State Sales Tax (US)</option>
                <option value="NONE">Tax Exempt (0% Flat)</option>
              </select>
              <span className="element-desc">Determines tax calculation formulas across all studio lines</span>
            </div>

            <div className="form-group">
              <label className="form-label">Default Payment Terms (Net Days)</label>
              <input
                type="number"
                className="form-input"
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(parseInt(e.target.value, 10) || 30)}
              />
              <span className="element-desc">Default days offset between invoice issue date and payment due date</span>
            </div>

            <button type="submit" className="btn btn-primary" disabled={isSavingOrg} style={{ alignSelf: 'flex-start' }}>
              <CheckCircle2 size={16} /> Save Tenant Settings
            </button>
          </form>
        </div>
      )}

      {/* Tab 4: Custom Invoice Templates Studio */}
      {activeTab === 'templates' && <InvoiceTemplateCustomizer />}
    </div>
  );
};

