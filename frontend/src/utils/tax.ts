import { useAuth } from '../context/AuthContext';

export type TaxSystem = 'GST' | 'VAT' | 'SALES_TAX' | 'NONE';

const LABELS: Record<TaxSystem, { tax: string; taxId: string; system: string }> = {
  GST: { tax: 'GST', taxId: 'GSTIN', system: 'GST' },
  VAT: { tax: 'VAT', taxId: 'VAT No.', system: 'VAT' },
  SALES_TAX: { tax: 'Sales Tax', taxId: 'Tax ID', system: 'Sales Tax' },
  NONE: { tax: 'Tax', taxId: 'Tax ID', system: 'No Tax' },
};

/** Common statutory rates offered in tax dropdowns, per tax system. */
export const TAX_RATE_PRESETS: Record<TaxSystem, number[]> = {
  GST: [0, 0.05, 0.12, 0.18, 0.28],
  VAT: [0, 0.05, 0.055, 0.07, 0.1, 0.19, 0.2, 0.21],
  SALES_TAX: [0, 0.04, 0.05, 0.06, 0.0625, 0.07, 0.0725, 0.08, 0.0825, 0.0875, 0.1],
  NONE: [0],
};

const DEFAULT_RATE: Record<TaxSystem, number> = { GST: 0.18, VAT: 0.2, SALES_TAX: 0, NONE: 0 };

export function formatTaxRate(rate: number): string {
  return `${Number((rate * 100).toFixed(2))}%`;
}

/** Tax wording and defaults for the active organization's tax system. */
export function useTaxSystem() {
  const { organization } = useAuth();
  const raw = organization?.settings?.taxSystem as TaxSystem | undefined;
  const system: TaxSystem = raw && raw in LABELS ? raw : 'GST';
  return {
    system,
    isGst: system === 'GST',
    label: LABELS[system].tax,
    taxIdLabel: LABELS[system].taxId,
    systemLabel: LABELS[system].system,
    rates: TAX_RATE_PRESETS[system],
    defaultRate: DEFAULT_RATE[system],
  };
}
