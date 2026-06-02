import { useState } from 'react';
import styles from './EdgePanel.module.scss';

export default function EdgePanel({
  voices, selectedVoice, rate, pitch, warn,
  onVoiceChange, onRateChange, onPitchChange,
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className={styles.wrap}>
      <button className={styles.toggle} onClick={() => setOpen(o => !o)}>
        <span>Edge TTS Settings</span>
        <span className={styles.arrow}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.panel}>
          {warn && <div className={styles.warn}>{warn}</div>}

          <div className={styles.section}>
            <span className={styles.sectionLabel}>Voice</span>
            <select
              className={styles.select}
              value={selectedVoice}
              onChange={e => onVoiceChange(e.target.value)}
              disabled={voices.length === 0}
            >
              {voices.length === 0 ? (
                <option value="">No neural voices available</option>
              ) : (
                voices.map(v => (
                  <option key={v.name} value={v.name}>
                    {v.name.replace(' Online (Natural) - English (United States)', '')}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className={styles.sliders}>
            <div className={styles.sliderGroup}>
              <div className={styles.sliderHeader}>
                <span>Speed</span>
                <strong>{rate.toFixed(2)}x</strong>
              </div>
              <input
                type="range"
                className={styles.slider}
                min="0.5" max="1.5" step="0.05"
                value={rate}
                onChange={e => onRateChange(parseFloat(e.target.value))}
              />
              <div className={styles.ticks}>
                <span>0.5×</span>
                <span>1.0×</span>
                <span>1.5×</span>
              </div>
            </div>

            <div className={styles.sliderGroup}>
              <div className={styles.sliderHeader}>
                <span>Pitch</span>
                <strong>{pitch.toFixed(2)}</strong>
              </div>
              <input
                type="range"
                className={styles.slider}
                min="0.5" max="1.5" step="0.05"
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
        </div>
      )}
    </div>
  );
}
