import { InvoiceItem, InvoiceTotals, TaxBreakdown } from '@billing/shared';
import { calculateLineTaxes } from '../tax-engine/tax-calculator';

export interface RawInvoiceItemInput {
  productId?: string;
  sku?: string;
  description: string;
  unit?: string;
  quantity: number;
  unitPrice?: number;
  pricingTiers?: { minQuantity: number; maxQuantity?: number; unitPrice: number }[];
  discountAmount?: number;
  discountPercentage?: number;
  taxRate?: number;
  hsnSacCode?: string;
  customFields?: Record<string, any>;
}

export interface CalculationOptions {
  taxSystem: 'GST' | 'VAT' | 'SALES_TAX' | 'NONE';
  originState?: string;
  destinationState?: string;
  invoiceDiscountAmount?: number;
}

/**
 * Resolves unit price based on volume tiers if configured, otherwise uses baseline unit price.
 */
export function resolveTierPrice(quantity: number, basePrice: number, tiers?: { minQuantity: number; maxQuantity?: number; unitPrice: number }[]): number {
  if (!tiers || tiers.length === 0) return basePrice;
  const matchedTier = tiers.find((tier) => {
    const minOk = quantity >= tier.minQuantity;
    const maxOk = tier.maxQuantity === undefined || tier.maxQuantity === null || quantity <= tier.maxQuantity;
    return minOk && maxOk;
  });
  return matchedTier ? matchedTier.unitPrice : basePrice;
}

/**
 * The single authoritative invoice calculation path used by Invoices, POS and Recurring.
 *
 * Invoice-level discounts are allocated PROPORTIONALLY across line items BEFORE tax is
 * computed, so tax always applies to the discounted taxable base (standard GST/VAT
 * practice). This guarantees: grandTotal == taxableAmount + taxTotal for any discount.
 */
export function calculateInvoice(
  itemsInput: RawInvoiceItemInput[],
  options: CalculationOptions
): {
  items: InvoiceItem[];
  totals: InvoiceTotals;
} {
  let rawSubtotal = 0;
  let itemDiscountTotal = 0;
  let taxableAmount = 0;
  let taxTotal = 0;
  const aggregatedTaxMap: Record<string, TaxBreakdown> = {};

  // Pass 1: resolve each line's base amount, line discount and discounted taxable base.
  // Taxes are NOT computed here — they need the invoice-level discount allocation first.
  const lines = itemsInput.map((item) => {
    // quantity: 0 must stay 0 (never silently become 1); negatives and NaN clamp to 0.
    const rawQty = Number(item.quantity);
    const qty = Number.isFinite(rawQty) ? Math.max(0, rawQty) : 0;

    const resolvedPrice = resolveTierPrice(qty, Number(item.unitPrice) || 0, item.pricingTiers);
    const unitPrice = Math.max(0, resolvedPrice);
    const baseAmount = Math.round(qty * unitPrice * 100) / 100;

    let discount = Number(item.discountAmount) || 0;
    let discountPercentage = Number(item.discountPercentage) || 0;
    // Percentage discounts are clamped to [0, 100] — >100% would create negative taxable
    // value and (worse) negative tax, i.e. the invoice would PAY the customer.
    discountPercentage = Math.min(100, Math.max(0, discountPercentage));
    if (discountPercentage > 0) {
      discount = Math.round(baseAmount * (discountPercentage / 100) * 100) / 100;
    }
    discount = Math.min(baseAmount, Math.max(0, discount));

    const lineTaxableBeforeInvoiceDiscount = Math.round((baseAmount - discount) * 100) / 100;
    const taxRate = Number(item.taxRate) || 0;

    rawSubtotal += baseAmount;
    itemDiscountTotal += discount;

    return { item, qty, unitPrice, baseAmount, discount, discountPercentage, lineTaxableBeforeInvoiceDiscount, taxRate };
  });

  // Pass 2: allocate the invoice-level discount proportionally over lines that still have
  // taxable value, so every line's tax is computed on its final discounted base.
  const invoiceDiscount = Math.max(0, Number(options.invoiceDiscountAmount) || 0);
  const totalTaxableBeforeInvoiceDiscount = lines.reduce((sum, l) => sum + l.lineTaxableBeforeInvoiceDiscount, 0);

  let allocatedInvoiceDiscount = 0;
  const allocated = lines.map((l, index) => {
    let invoiceDiscountShare = 0;
    if (invoiceDiscount > 0 && totalTaxableBeforeInvoiceDiscount > 0 && l.lineTaxableBeforeInvoiceDiscount > 0) {
      const isLastTaxableLine = !lines.slice(index + 1).some((x) => x.lineTaxableBeforeInvoiceDiscount > 0);
      if (isLastTaxableLine) {
        // Last taxable line absorbs rounding remainder so the allocation sums exactly.
        invoiceDiscountShare = Math.round((invoiceDiscount - allocatedInvoiceDiscount) * 100) / 100;
      } else {
        invoiceDiscountShare =
          Math.round((l.lineTaxableBeforeInvoiceDiscount / totalTaxableBeforeInvoiceDiscount) * invoiceDiscount * 100) / 100;
      }
      invoiceDiscountShare = Math.min(invoiceDiscountShare, l.lineTaxableBeforeInvoiceDiscount);
      allocatedInvoiceDiscount = Math.round((allocatedInvoiceDiscount + invoiceDiscountShare) * 100) / 100;
    }
    const lineTaxable = Math.max(0, Math.round((l.lineTaxableBeforeInvoiceDiscount - invoiceDiscountShare) * 100) / 100);

    const { taxAmount: lineTaxAmount, breakdown } = calculateLineTaxes({
      taxSystem: options.taxSystem,
      taxRate: l.taxRate,
      taxableAmount: lineTaxable,
      originState: options.originState,
      destinationState: options.destinationState,
    });

    const lineTotal = Math.round((lineTaxable + lineTaxAmount) * 100) / 100;

    taxableAmount += lineTaxable;
    taxTotal += lineTaxAmount;

    for (const b of breakdown) {
      const key = `${b.taxType}_${b.rate}`;
      if (!aggregatedTaxMap[key]) {
        aggregatedTaxMap[key] = {
          taxType: b.taxType,
          rate: b.rate,
          taxableAmount: 0,
          taxAmount: 0,
        };
      }
      aggregatedTaxMap[key].taxableAmount =
        Math.round((aggregatedTaxMap[key].taxableAmount + b.taxableAmount) * 100) / 100;
      aggregatedTaxMap[key].taxAmount =
        Math.round((aggregatedTaxMap[key].taxAmount + b.taxAmount) * 100) / 100;
    }

    return { line: l, invoiceDiscountShare, lineTaxable, lineTaxAmount, lineTotal };
  });

  const processedItems: InvoiceItem[] = allocated.map((a) => ({
    productId: a.line.item.productId,
    sku: a.line.item.sku,
    description: a.line.item.description || 'Service/Product',
    unit: a.line.item.unit || 'unit',
    quantity: a.line.qty,
    unitPrice: a.line.unitPrice,
    discountAmount: a.line.discount,
    discountPercentage: a.line.discountPercentage,
    taxRate: a.line.taxRate,
    taxAmount: a.lineTaxAmount,
    hsnSacCode: a.line.item.hsnSacCode,
    lineTotal: a.lineTotal,
    customFields: a.line.item.customFields || {},
  }));

  const totalDiscount = Math.round((itemDiscountTotal + allocatedInvoiceDiscount) * 100) / 100;
  rawSubtotal = Math.round(rawSubtotal * 100) / 100;
  taxableAmount = Math.round(taxableAmount * 100) / 100;
  taxTotal = Math.round(taxTotal * 100) / 100;
  const grandTotal = Math.round((taxableAmount + taxTotal) * 100) / 100;

  const totals: InvoiceTotals = {
    rawSubtotal,
    itemDiscountTotal: Math.round(itemDiscountTotal * 100) / 100,
    invoiceDiscountTotal: Math.round(allocatedInvoiceDiscount * 100) / 100,
    totalDiscount,
    taxableAmount,
    taxBreakdown: Object.values(aggregatedTaxMap),
    taxTotal,
    grandTotal,
    amountPaid: 0,
    amountDue: grandTotal,
  };

  return {
    items: processedItems,
    totals,
  };
}
