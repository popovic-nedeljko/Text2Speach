import styles from './PauseOverlay.module.scss';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PauseOverlay({ countdown, onSkip }) {
  return (
    <div className={styles.overlay}>
      <p className={styles.label}>Long pause</p>
      <div className={styles.timer}>{formatTime(countdown.remaining)}</div>
      <button className={styles.skipBtn} onClick={onSkip}>
        &#187; Skip pause
      </button>
    </div>
  );
}
