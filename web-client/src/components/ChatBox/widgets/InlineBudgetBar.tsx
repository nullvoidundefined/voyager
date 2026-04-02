import styles from "./InlineBudgetBar.module.scss";

interface InlineBudgetBarProps {
    allocated: number;
    total: number;
    currency: string;
}

export function InlineBudgetBar({ allocated, total, currency }: InlineBudgetBarProps) {
    const pct = Math.min((allocated / total) * 100, 100);
    const overBudget = allocated > total;
    const remaining = total - allocated;

    const fmt = (n: number) =>
        new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(Math.abs(n));

    return (
        <div className={styles.wrapper}>
            <div className={styles.track}>
                <div
                    className={`${styles.fill} ${overBudget ? styles.over : ""}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <div className={styles.labels}>
                <span className={styles.allocated}>{fmt(allocated)} allocated</span>
                <span className={`${styles.remaining} ${overBudget ? styles.over : ""}`}>
                    {fmt(Math.abs(remaining))} {overBudget ? "over" : "remaining"}
                </span>
            </div>
        </div>
    );
}
