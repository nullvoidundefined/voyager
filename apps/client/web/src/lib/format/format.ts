/**
 * Shared display formatters for currency and short dates. Caches Intl formatters
 * by currency to avoid re-instantiation, and parses date-only strings as local
 * midnight to prevent timezone off-by-one shifts.
 */

const formatterCache = new Map<string, Intl.NumberFormat>();

export function formatCurrency(
  amount: number | null,
  currency: string = 'USD',
): string {
  if (amount == null) return '-';
  let fmt = formatterCache.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    formatterCache.set(currency, fmt);
  }
  return fmt.format(amount);
}

export function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Not set';
  // If the string already contains a time component (T or space-separated),
  // parse it directly; otherwise append T00:00:00 to avoid timezone shift.
  const date = dateStr.includes('T')
    ? new Date(dateStr)
    : new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
