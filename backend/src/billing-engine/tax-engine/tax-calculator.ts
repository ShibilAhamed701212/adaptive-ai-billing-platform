import { TaxBreakdown } from '@billing/shared';

export interface TaxCalculationParams {
  taxSystem: 'GST' | 'VAT' | 'SALES_TAX' | 'NONE';
  taxRate: number; // e.g. 0.18 for 18%
  taxableAmount: number;
  originState?: string;
  destinationState?: string;
}

export function calculateLineTaxes(params: TaxCalculationParams): {
  taxAmount: number;
  breakdown: TaxBreakdown[];
} {
  const { taxSystem, taxRate, taxableAmount, originState, destinationState } = params;

  if (taxSystem === 'NONE' || taxRate <= 0 || taxableAmount <= 0) {
    return { taxAmount: 0, breakdown: [] };
  }

  const roundedTaxable = Math.round(taxableAmount * 100) / 100;
  const totalTax = Math.round(roundedTaxable * taxRate * 100) / 100;

  if (taxSystem === 'GST') {
    // Check if intra-state or inter-state
    const isInterState =
      Boolean(originState && destinationState) &&
      originState?.trim().toLowerCase() !== destinationState?.trim().toLowerCase();

    if (isInterState) {
      return {
        taxAmount: totalTax,
        breakdown: [
          {
            taxType: 'IGST',
            rate: taxRate,
            taxableAmount: roundedTaxable,
            taxAmount: totalTax,
          },
        ],
      };
    } else {
      // Intra-state split: CGST (half) + SGST (half)
      const halfRate = taxRate / 2;
      const cgst = Math.round(roundedTaxable * halfRate * 100) / 100;
      const sgst = Math.round((totalTax - cgst) * 100) / 100;

      return {
        taxAmount: totalTax,
        breakdown: [
          {
            taxType: 'CGST',
            rate: halfRate,
            taxableAmount: roundedTaxable,
            taxAmount: cgst,
          },
          {
            taxType: 'SGST',
            rate: halfRate,
            taxableAmount: roundedTaxable,
            taxAmount: sgst,
          },
        ],
      };
    }
  }

  if (taxSystem === 'VAT') {
    return {
      taxAmount: totalTax,
      breakdown: [
        {
          taxType: 'VAT',
          rate: taxRate,
          taxableAmount: roundedTaxable,
          taxAmount: totalTax,
        },
      ],
    };
  }

  // SALES_TAX or generic
  return {
    taxAmount: totalTax,
    breakdown: [
      {
        taxType: 'SALES_TAX',
        rate: taxRate,
        taxableAmount: roundedTaxable,
        taxAmount: totalTax,
      },
    ],
  };
}
