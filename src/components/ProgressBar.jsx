import styles from './ProgressBar.module.scss';

export default function ProgressBar({ done, total, words, chars }) {
  const pct = total > 0 ? (done / total) * 100 : 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.labels}>
        <span>Progress</span>
        <span className={styles.stats}>
          <span>{done} / {total} sentences</span>
          <span className={styles.sep}>·</span>
          <span>{words.toLocaleString()} words</span>
          <span className={styles.sep}>·</span>
          <span>{chars.toLocaleString()} chars</span>
        </span>
      </div>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
