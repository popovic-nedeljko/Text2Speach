import styles from './Controls.module.scss';

function fmtTime(s) {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const r = t % 60;
  return `${h}h ${String(m).padStart(2, '0')}min ${String(r).padStart(2, '0')}sec`;
}

export default function Controls({ status, onPlay, onPause, onResume, onStop, elapsedSec = 0, totalSec = 0 }) {
  const isPlaying = status === 'playing';
  const isPaused  = status === 'paused';
  const isActive  = isPlaying || isPaused;

  return (
    <div className={styles.controls}>
      <button
        className={`${styles.btn} ${styles.play} ${isPlaying ? styles.pulsing : ''}`}
        onClick={onPlay}
        disabled={isActive}
        aria-label="Play"
      >
        ▶ Play
      </button>

      <button
        className={`${styles.btn} ${styles.secondary}`}
        onClick={onPause}
        disabled={!isPlaying}
        aria-label="Pause"
      >
        ⏸ Pause
      </button>

      <button
        className={`${styles.btn} ${styles.secondary}`}
        onClick={onResume}
        disabled={!isPaused}
        aria-label="Resume"
      >
        ▶ Resume
      </button>

      <button
        className={`${styles.btn} ${styles.secondary}`}
        onClick={onStop}
        disabled={!isActive}
        aria-label="Stop"
      >
        ■ Stop
      </button>

      {totalSec > 0 && (
        <span className={styles.time}>
          {fmtTime(elapsedSec)} / {fmtTime(totalSec)}
        </span>
      )}
    </div>
  );
}
