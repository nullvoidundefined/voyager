/**
 * Configurable placeholder block shown while content loads, reducing layout shift and
 * signaling pending state in place of real UI.
 */
import styles from './Skeleton.module.scss';

interface SkeletonProps {
  width: number | string;
  height: number | string;
  borderRadius?: number | string;
}

export function Skeleton({ width, height, borderRadius = 4 }: SkeletonProps) {
  const toCSS = (v: number | string) => (typeof v === 'number' ? `${v}px` : v);
  return (
    <div
      aria-hidden='true'
      className={styles.skeleton}
      style={{
        width: toCSS(width),
        height: toCSS(height),
        borderRadius: toCSS(borderRadius),
      }}
    />
  );
}
