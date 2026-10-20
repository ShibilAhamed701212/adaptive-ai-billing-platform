import { BusinessRule } from '@billing/shared';
import { calculateInvoice, CalculationOptions, RawInvoiceItemInput } from '../../billing-engine/calculators/invoice-calculator';
import { evaluateBusinessRules, RuleEvaluationResult } from './rule-evaluator';

/** SKU marking the line a surcharge rule adds, so a later recalculation can drop and re-derive it. */
export const RULE_SURCHARGE_SKU = 'RULE-SURCHARGE';

export function withoutRuleSurcharge<T extends { sku?: string }>(items: T[]): T[] {
  return items.filter((item) => item.sku !== RULE_SURCHARGE_SKU);
}

/**
 * Price an invoice and apply its `beforeInvoiceCalculate` business rules in one place, so the
 * preview, create and draft-edit paths all charge what the rules say:
 *  - `apply_discount` adds the rule percentage of the post-line-discount amount to the
 *    invoice-level discount (allocated across lines before tax, like any invoice discount);
 *  - `add_surcharge` adds one untaxed "Surcharge" line marked with RULE_SURCHARGE_SKU.
 * Rules are evaluated against the subtotal of the caller's own lines (any previous surcharge
 * line removed), so re-pricing a draft never compounds a rule's effect.
 */
export function priceInvoiceWithRules(
  rules: BusinessRule[],
  itemsInput: RawInvoiceItemInput[],
  options: CalculationOptions,
  context: { customerId?: string; customerState?: string; customFields?: Record<string, any> }
): ReturnType<typeof calculateInvoice> & { ruleEffects: RuleEvaluationResult; manualInvoiceDiscount: number } {
  const items = withoutRuleSurcharge(itemsInput);
  const manualInvoiceDiscount = Math.max(0, Number(options.invoiceDiscountAmount) || 0);
  const base = calculateInvoice(items, options);

  const ruleEffects = evaluateBusinessRules(rules, 'beforeInvoiceCalculate', {
    invoiceSubtotal: base.totals.rawSubtotal,
    customerId: context.customerId,
    customerState: context.customerState,
    itemCount: items.length,
    customFields: context.customFields,
  });

  const discountPct = Math.min(100, Math.max(0, Number(ruleEffects.modifiedDiscountPercentage) || 0));
  const surcharge = Math.max(0, Math.round((Number(ruleEffects.addedSurcharge) || 0) * 100) / 100);
  if (discountPct === 0 && surcharge === 0) {
    return { ...base, ruleEffects, manualInvoiceDiscount };
  }

  const afterLineDiscounts = base.totals.rawSubtotal - base.totals.itemDiscountTotal;
  const ruleDiscount = Math.round(afterLineDiscounts * (discountPct / 100) * 100) / 100;
  const discounted = ruleDiscount > 0
    ? calculateInvoice(items, { ...options, invoiceDiscountAmount: manualInvoiceDiscount + ruleDiscount })
    : base;
  if (surcharge === 0) {
    return { ...discounted, ruleEffects, manualInvoiceDiscount };
  }

  // The surcharge is priced on its own line so no invoice discount is allocated against it.
  const surchargeLine = calculateInvoice(
    [{ sku: RULE_SURCHARGE_SKU, description: 'Surcharge (business rule)', quantity: 1, unitPrice: surcharge, taxRate: 0 }],
    { ...options, invoiceDiscountAmount: 0 }
  );
  const round = (n: number) => Math.round(n * 100) / 100;
  const t = discounted.totals;
  const grandTotal = round(t.grandTotal + surchargeLine.totals.grandTotal);
  const priced = {
    items: [...discounted.items, ...surchargeLine.items],
    totals: {
      ...t,
      rawSubtotal: round(t.rawSubtotal + surchargeLine.totals.rawSubtotal),
      taxableAmount: round(t.taxableAmount + surchargeLine.totals.taxableAmount),
      grandTotal,
      amountDue: grandTotal,
    },
  };
  return { ...priced, ruleEffects, manualInvoiceDiscount };
}
