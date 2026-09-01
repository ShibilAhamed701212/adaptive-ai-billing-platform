import { BusinessRule } from '@billing/shared';

export interface RuleEvaluationResult {
  appliedRules: {
    ruleName: string;
    actionType: string;
    effect: string;
  }[];
  modifiedDiscountPercentage?: number;
  addedSurcharge?: number;
  requireApproval?: boolean;
  approvalReason?: string;
  injectedFields?: Record<string, any>;
}

export function evaluateBusinessRules(
  rules: BusinessRule[],
  event: 'beforeInvoiceCalculate' | 'onInvoiceCreate' | 'onPaymentReceive' | 'onInvoiceSent',
  context: {
    invoiceSubtotal?: number;
    customerId?: string;
    customerTags?: string[];
    customerState?: string;
    itemCount?: number;
    customFields?: Record<string, any>;
  }
): RuleEvaluationResult {
  const result: RuleEvaluationResult = {
    appliedRules: [],
    injectedFields: {},
  };

  const activeEventRules = rules.filter((r) => r.isActive && r.event === event);

  for (const rule of activeEventRules) {
    const { condition, action } = rule;
    let conditionMatched = false;

    // Get context field value
    let fieldValue: any;
    if (condition.field === 'invoiceSubtotal') {
      fieldValue = context.invoiceSubtotal || 0;
    } else if (condition.field === 'itemCount') {
      fieldValue = context.itemCount || 0;
    } else if (condition.field === 'customerState') {
      fieldValue = context.customerState;
    } else if (condition.field.startsWith('customFields.')) {
      const key = condition.field.replace('customFields.', '');
      fieldValue = context.customFields?.[key];
    }

    // Evaluate operator
    switch (condition.operator) {
      case 'greater_than':
        conditionMatched = Number(fieldValue) > Number(condition.value);
        break;
      case 'less_than':
        conditionMatched = Number(fieldValue) < Number(condition.value);
        break;
      case 'equals':
        conditionMatched = String(fieldValue).toLowerCase() === String(condition.value).toLowerCase();
        break;
      case 'not_equals':
        conditionMatched = String(fieldValue).toLowerCase() !== String(condition.value).toLowerCase();
        break;
      case 'contains':
        if (Array.isArray(fieldValue)) {
          conditionMatched = fieldValue.includes(condition.value);
        } else if (typeof fieldValue === 'string') {
          conditionMatched = fieldValue.toLowerCase().includes(String(condition.value).toLowerCase());
        }
        break;
      case 'in':
        if (Array.isArray(condition.value)) {
          conditionMatched = condition.value.includes(fieldValue);
        }
        break;
    }

    if (conditionMatched) {
      switch (action.type) {
        case 'apply_discount':
          result.modifiedDiscountPercentage =
            (result.modifiedDiscountPercentage || 0) + Number(action.value);
          result.appliedRules.push({
            ruleName: rule.ruleName,
            actionType: action.type,
            effect: `Applied ${action.value}% rule discount`,
          });
          break;

        case 'add_surcharge':
          result.addedSurcharge = (result.addedSurcharge || 0) + Number(action.value);
          result.appliedRules.push({
            ruleName: rule.ruleName,
            actionType: action.type,
            effect: `Added ₹${action.value} rule surcharge`,
          });
          break;

        case 'require_approval':
          result.requireApproval = true;
          result.approvalReason = action.message || `Rule '${rule.ruleName}' triggered manager approval`;
          result.appliedRules.push({
            ruleName: rule.ruleName,
            actionType: action.type,
            effect: result.approvalReason,
          });
          break;

        case 'set_field':
          if (action.targetField) {
            result.injectedFields![action.targetField] = action.value;
            result.appliedRules.push({
              ruleName: rule.ruleName,
              actionType: action.type,
              effect: `Set customField '${action.targetField}' = ${JSON.stringify(action.value)}`,
            });
          }
          break;
      }
    }
  }

  return result;
}
