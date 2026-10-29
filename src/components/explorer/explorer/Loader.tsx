"use client";

import styles from "./Loader.module.css";

/**
 * Full preload indicator over the poster: the whole scene (every style and time of day) loads and
 * compiles before it shows, so this counts real progress. Wordmark, a thin gold line, nothing else.
 */
export function Loader({ show, progress, label }: { show: boolean; progress: number; label: string }) {
  const pct = Math.round(progress * 100);
  return (
    <div className={styles.loader} data-hidden={!show || undefined} role="status" aria-live="polite" aria-hidden={!show}>
      <p className={styles.wordmark}>Halo Wawer</p>
      <div className={styles.track} aria-hidden>
        <span className={styles.bar} style={{ transform: `scaleX(${Math.max(0.02, progress)})` }} />
      </div>
      <p className={styles.label}>
        {label}
        <span className={styles.pct}>{pct}%</span>
      </p>
    </div>
  );
}
