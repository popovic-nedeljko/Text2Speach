import { useState } from 'react';
import { GOOGLE_VOICES, DEFAULT_STYLE_PROMPT } from '../hooks/useTTS';
import styles from './GooglePanel.module.scss';

export default function GooglePanel({
  apiKey, voice, prompt, pitch, rate,
  onApiKeyChange, onVoiceChange, onPromptChange, onPitchChange, onRateChange,
}) {
  const [open,     setOpen]     = useState(false);
  const [localKey, setLocalKey] = useState(apiKey);
  const [showKey,  setShowKey]  = useState(false);

  function handleSaveKey() { onApiKeyChange(localKey.trim()); }

  return (
    <div className={styles.wrap}>
      <button className={styles.toggle} onClick={() => setOpen(o => !o)}>
        <span>Google Gemini Settings</span>
        <span className={styles.arrow}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.panel}>

          {/* ── API key ── */}
          <section className={styles.section}>
            <p className={styles.sectionLabel}>Google API Key</p>
            <div className={styles.keyRow}>
              <input
                type={showKey ? 'text' : 'password'}
                className={styles.input}
                value={localKey}
                onChange={e => setLocalKey(e.target.value)}
                placeholder="AIza..."
                onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
              />
              <button className={styles.ghostBtn} onClick={() => setShowKey(s => !s)}>
                {showKey ? 'Hide' : 'Show'}
              </button>
              <button className={styles.primaryBtn} onClick={handleSaveKey}>
                Save
              </button>
            </div>
            <p className={styles.hint}>
              Enable "Cloud Text-to-Speech API" in Google Cloud Console.
            </p>
          </section>

          {/* ── Voice dropdown ── */}
          <section className={styles.section}>
            <p className={styles.sectionLabel}>Voice</p>
            <select
              className={styles.select}
              value={voice}
              onChange={e => onVoiceChange(e.target.value)}
            >
              {GOOGLE_VOICES.map(v => (
                <option key={v.name} value={v.name}>
                  {v.name} — {v.desc}
                </option>
              ))}
            </select>
          </section>

          {/* ── Style prompt ── */}
          <section className={styles.section}>
            <p className={styles.sectionLabel}>Style Prompt</p>
            <textarea
              className={styles.textarea}
              rows={3}
              value={prompt}
              onChange={e => onPromptChange(e.target.value)}
              placeholder={DEFAULT_STYLE_PROMPT}
            />
          </section>

          {/* ── Sliders ── */}
          <div className={styles.sliders}>

            <div className={styles.sliderGroup}>
              <div className={styles.sliderHeader}>
                <span>Pitch</span>
                <strong>{pitch > 0 ? `+${pitch}` : pitch}</strong>
              </div>
              <input
                type="range"
                className={styles.slider}
                min="-10" max="10" step="0.5"
                value={pitch}
                onChange={e => onPitchChange(parseFloat(e.target.value))}
              />
              <div className={styles.ticks}>
                <span>−10 deeper</span>
                <span>0</span>
                <span>+10 higher</span>
              </div>
            </div>

            <div className={styles.sliderGroup}>
              <div className={styles.sliderHeader}>
                <span>Speaking Rate</span>
                <strong>{rate.toFixed(2)}×</strong>
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

          </div>
        </div>
      )}
    </div>
  );
}
