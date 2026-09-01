export type CustomFieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'textarea';

export type TargetEntity = 'customer' | 'product' | 'invoice' | 'invoice_item' | 'payment';

export interface CustomFieldDefinition {
  _id?: string | any;
  organizationId: string | any;
  targetEntity: TargetEntity;
  fieldName: string; // Internal key e.g. "projectCode"
  label: string;      // Display label e.g. "Project Code"
  fieldType: CustomFieldType;
  required: boolean;
  defaultValue?: any;
  options?: string[]; // for select/multiselect
  placeholder?: string;
  validationRegex?: string;
  isSearchable?: boolean;
  order: number;
}

export interface BusinessRule {
  _id?: string | any;
  organizationId: string | any;
  ruleName: string;
  description?: string;
  event: 'beforeInvoiceCalculate' | 'onInvoiceCreate' | 'onPaymentReceive' | 'onInvoiceSent';
  condition: {
    field: string;
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in';
    value: any;
  };
  action: {
    type: 'apply_discount' | 'add_surcharge' | 'require_approval' | 'tag_customer' | 'set_field';
    targetField?: string;
    value: any;
    message?: string;
  };
  isActive: boolean;
}

export interface BillingModelPreset {
  id: string;
  name: string;
  description: string;
  industry: string;
  defaultTaxSystem: 'GST' | 'VAT' | 'SALES_TAX' | 'NONE';
  defaultModules: string[];
  suggestedCustomFields: Omit<CustomFieldDefinition, 'organizationId' | '_id'>[];
  defaultRules?: Partial<BusinessRule>[];
}
