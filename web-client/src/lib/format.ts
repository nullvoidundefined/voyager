const formatterCache = new Map<string, Intl.NumberFormat>();

export function formatCurrency(
    amount: number | null,
    currency: string = "USD",
): string {
    if (amount == null) return "-";
    let fmt = formatterCache.get(currency);
    if (!fmt) {
        fmt = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        });
        formatterCache.set(currency, fmt);
    }
    return fmt.format(amount);
}

export function formatShortDate(dateStr: string | null): string {
    if (!dateStr) return "TBD";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}
