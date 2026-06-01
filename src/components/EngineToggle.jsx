import styles from './EngineToggle.module.scss';

export default function EngineToggle({ engine, onChange }) {
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
      </div>
      <span className={styles.badge}>
        {engine === 'google' ? 'Gemini 3.1 Flash' : 'Turbo v2.5'}
      </span>
    </div>
  );
}
