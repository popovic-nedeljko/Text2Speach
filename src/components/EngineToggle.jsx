import styles from './EngineToggle.module.scss';

export default function EngineToggle({ engine, onChange }) {
  const badge =
    engine === 'google' ? 'Gemini 3.1 Flash' :
    engine === 'edge'   ? 'Free · Neural'     :
                          'Turbo v2.5';

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Voice Engine</span>
      <div className={styles.group}>
        <button
          className={`${styles.btn} ${engine === 'elevenlabs' ? styles.active : ''}`}
          onClick={() => onChange('elevenlabs')}
        >
          ElevenLabs
        </button>
        <button
          className={`${styles.btn} ${engine === 'google' ? styles.active : ''}`}
          onClick={() => onChange('google')}
        >
          Google Gemini
        </button>
        <button
          className={`${styles.btn} ${engine === 'edge' ? styles.active : ''}`}
          onClick={() => onChange('edge')}
        >
          Edge TTS
        </button>
      </div>
      <span className={styles.badge}>{badge}</span>
    </div>
  );
}
