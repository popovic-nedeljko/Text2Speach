import styles from './Controls.module.scss';

export default function Controls({ status, onPlay, onPause, onResume, onStop }) {
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
    </div>
  );
}
