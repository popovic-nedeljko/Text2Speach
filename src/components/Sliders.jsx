import styles from './Sliders.module.scss';

export default function Sliders({ rate, pitch, onRateChange, onPitchChange }) {
  return (
    <div className={styles.grid}>
      <div className={styles.group}>
        <div className={styles.header}>
          <span>Speed</span>
          <strong>{rate.toFixed(2)}x</strong>
        </div>
        <input
          type="range"
          className={styles.slider}
          min="0.5" max="1.2" step="0.05"
          value={rate}
          onChange={e => onRateChange(parseFloat(e.target.value))}
        />
        <div className={styles.ticks}>
          <span>0.5×</span>
          <span>0.85×</span>
          <span>1.2×</span>
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.header}>
          <span>Pitch</span>
          <strong>{pitch.toFixed(2)}</strong>
        </div>
        <input
          type="range"
          className={styles.slider}
          min="0.5" max="1.0" step="0.05"
          value={pitch}
          onChange={e => onPitchChange(parseFloat(e.target.value))}
        />
        <div className={styles.ticks}>
          <span>Low</span>
          <span>Mid</span>
          <span>High</span>
        </div>
      </div>
    </div>
  );
}
