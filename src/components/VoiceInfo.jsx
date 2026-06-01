import { hasNeuralVoices } from '../hooks/useTTS';
import styles from './VoiceInfo.module.scss';

export default function VoiceInfo({ voice, allVoices, onVoiceChange }) {
  const neural  = hasNeuralVoices(allVoices);
  const loading = allVoices.length === 0;

  function handleChange(e) {
    const selected = allVoices.find(v => v.name === e.target.value);
    if (selected) onVoiceChange(selected);
  }

  return (
    <div className={styles.wrap}>
      {/* Warning shown only when voices have loaded but none are neural */}
      {!loading && !neural && (
        <div className={styles.warning}>
          ⚠️ Natural voices not detected. Open this app in Microsoft Edge for best
          results. Currently using: <strong>{voice?.name ?? 'none'}</strong>
        </div>
      )}

      <div className={styles.row}>
        <label className={styles.label} htmlFor="voiceSelect">
          Voice
        </label>

        <select
          id="voiceSelect"
          className={styles.select}
          value={voice?.name ?? ''}
          onChange={handleChange}
          disabled={loading}
        >
          {loading && <option value="">Loading voices…</option>}

          {!loading && allVoices.map(v => (
            <option key={v.name} value={v.name}>
              {v.name}
            </option>
          ))}
        </select>
      </div>

      {/* Active voice badge */}
      {voice && neural && (
        <p className={styles.badge}>
          <span className={styles.dot} /> Neural voice active
        </p>
      )}
    </div>
  );
}
