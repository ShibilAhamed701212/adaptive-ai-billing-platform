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

  const processedItems: InvoiceItem[] = itemsInput.map((item) => {
    const qty = Math.max(0.0001, Number(item.quantity) || 1);
    const resolvedPrice = resolveTierPrice(qty, Number(item.unitPrice) || 0, item.pricingTiers);
    const unitPrice = Math.max(0, resolvedPrice);
    const baseAmount = Math.round(qty * unitPrice * 100) / 100;

    let discount = Number(item.discountAmount) || 0;
    if (item.discountPercentage && item.discountPercentage > 0) {
      discount = Math.round(baseAmount * (item.discountPercentage / 100) * 100) / 100;
    }
    discount = Math.min(baseAmount, Math.max(0, discount));

    const lineTaxable = Math.round((baseAmount - discount) * 100) / 100;
    const taxRate = Number(item.taxRate) || 0;

    const { taxAmount: lineTaxAmount, breakdown } = calculateLineTaxes({
      taxSystem: options.taxSystem,
      taxRate,
      taxableAmount: lineTaxable,
      originState: options.originState,
      destinationState: options.destinationState,
    });

    const lineTotal = Math.round((lineTaxable + lineTaxAmount) * 100) / 100;

    // Aggregate totals
    rawSubtotal += baseAmount;
    itemDiscountTotal += discount;
    taxableAmount += lineTaxable;
    taxTotal += lineTaxAmount;

    // Aggregate tax breakdown across lines
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

    return {
      productId: item.productId,
      sku: item.sku,
      description: item.description || 'Service/Product',
      unit: item.unit || 'unit',
      quantity: qty,
      unitPrice,
      discountAmount: discount,
      discountPercentage: item.discountPercentage || 0,
      taxRate,
      taxAmount: lineTaxAmount,
      hsnSacCode: item.hsnSacCode,
      lineTotal,
      customFields: item.customFields || {},
    };
  });

  const invoiceDiscount = Math.max(0, Number(options.invoiceDiscountAmount) || 0);
  const totalDiscount = Math.round((itemDiscountTotal + invoiceDiscount) * 100) / 100;
  rawSubtotal = Math.round(rawSubtotal * 100) / 100;
  taxableAmount = Math.round((rawSubtotal - totalDiscount) * 100) / 100;
  taxTotal = Math.round(taxTotal * 100) / 100;
  const grandTotal = Math.round((taxableAmount + taxTotal) * 100) / 100;

  const totals: InvoiceTotals = {
    rawSubtotal,
    itemDiscountTotal: Math.round(itemDiscountTotal * 100) / 100,
    invoiceDiscountTotal: invoiceDiscount,
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
