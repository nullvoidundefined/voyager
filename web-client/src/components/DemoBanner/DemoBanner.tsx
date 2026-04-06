import styles from './DemoBanner.module.scss';

/**
 * Honest disclosure banner for the Voyager portfolio demo.
 *
 * Voyager is a technical demonstration of an agentic AI travel planning
 * pattern, not a commercial booking service. This banner makes that clear
 * to any viewer at first glance and links to the engineering audit for
 * curious reviewers.
 */
export function DemoBanner() {
  return (
    <aside
      className={styles.banner}
      role='note'
      aria-label='Portfolio demo disclosure'
    >
      <div className={styles.content}>
        <span className={styles.label}>Portfolio demo</span>
        <span className={styles.text}>
          This is a technical demonstration of an agentic AI travel planning
          pattern, not a commercial booking service.
        </span>
        <a
          href='/docs/audits/2026-04-06-engineering.md'
          className={styles.link}
        >
          Read the engineering audit
        </a>
      </div>
    </aside>
  );
}
