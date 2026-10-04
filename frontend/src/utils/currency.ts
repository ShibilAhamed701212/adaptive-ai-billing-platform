import { useAuth } from '../context/AuthContext';

export const DEFAULT_CURRENCY_SYMBOL = '₹';

/**
 * Format a monetary amount with the organization's currency symbol.
 * Places the sign before the symbol (-₹1,234.50) and always shows two decimals.
 */
export function formatMoney(amount: number | null | undefined, symbol = DEFAULT_CURRENCY_SYMBOL, fractionDigits = 2): string {
  const value = Number(amount) || 0;
  const abs = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${value < 0 ? '-' : ''}${symbol}${abs}`;
}

/** The active organization's currency symbol, falling back to ₹. */
export function useCurrencySymbol(): string {
  const { organization } = useAuth();
  return organization?.settings?.currencySymbol || DEFAULT_CURRENCY_SYMBOL;
}
