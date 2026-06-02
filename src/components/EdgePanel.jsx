import { useState } from 'react';
import { EDGE_DEFAULT_STYLE_PROMPT } from '../hooks/useTTS';
import styles from './EdgePanel.module.scss';

const MEDITATION_VOICES = [
  { full: 'Microsoft Davis Online (Natural) - English (United States)',                      label: 'Davis',   lang: 'en-US', desc: 'Najopušteniji, topao, prirodan — najbliži William-u', best: true },
  { full: 'Microsoft Guy Online (Natural) - English (United States)',                        label: 'Guy',     lang: 'en-US', desc: 'Dubok, autoritativan, malo formalniji' },
  { full: 'Microsoft Jason Online (Natural) - English (United States)',                      label: 'Jason',   lang: 'en-US', desc: 'Mlađi, energičan' },
  { full: 'Microsoft Tony Online (Natural) - English (United States)',                       label: 'Tony',    lang: 'en-US', desc: 'Čist, profesionalan, neutralan' },
  { full: 'Microsoft Andrew Multilingual Online (Natural) - English (United States)',        label: 'Andrew',  lang: 'en-US', desc: 'Najnoviji, konverzacijski, veoma prirodan' },
  { full: 'Microsoft Brian Multilingual Online (Natural) - English (United States)',         label: 'Brian',   lang: 'en-US', desc: 'Moderan, prirodan, svestran' },
  { full: 'Microsoft Ryan Online (Natural) - English (United Kingdom)',                      label: 'Ryan',    lang: 'en-GB', desc: 'Britanski naglasak, dubok i uravnotežen' },
  { full: 'Microsoft Thomas Online (Natural) - English (United Kingdom)',                    label: 'Thomas',  lang: 'en-GB', desc: 'Miran, britanski, malo tamniji ton' },
  { full: 'Microsoft William Online (Natural) - English (Australia)',                        label: 'William', lang: 'en-AU', desc: 'Australijski, opušten i dubok' },
];

function shortName(fullName) {
  return fullName.replace(/\s+Online \(Natural\).*/i, '');
}

function fmtParams(p) {
  if (!p) return '';
  return `Rate: ${p.rate} · Pitch: ${p.pitch} · Break: ${p.breakBetweenSentences} · Emphasis: ${p.emphasis}`;
}

export default function EdgePanel({
  voices, selectedVoice, rate, pitch, warn,
  onVoiceChange, onRateChange, onPitchChange,
  anthropicKey, edStylePrompt, edStyleParams, edStyleStatus,
  onAnthropicKeyChange, onEdStylePromptChange,
}) {
  const [open,        setOpen]       = useState(true);
  const [showKey,     setShowKey]    = useState(false);

  const loadedNames = new Set(voices.map(v => v.name));

  return (
    <div className={styles.wrap}>
      <button className={styles.toggle} onClick={() => setOpen(o => !o)}>
        <span>Edge TTS Settings</span>
        <span className={styles.arrow}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.panel}>
          {warn && <div className={styles.warn}>{warn}</div>}

          {/* ── Voice Style Prompt ─────────────────────────── */}
          <div className={styles.section}>
            <span className={styles.sectionLabel}>Voice Style Prompt</span>
            <textarea
              className={styles.textarea}
              rows={3}
              placeholder={EDGE_DEFAULT_STYLE_PROMPT}
              value={edStylePrompt}
              onChange={e => onEdStylePromptChange(e.target.value)}
            />

            {/* Anthropic API key */}
            <div className={styles.keyRow}>
              <input
                type={showKey ? 'text' : 'password'}
                className={styles.input}
                placeholder="Anthropic API key (sk-ant-…)"
                value={anthropicKey}
                onChange={e => onAnthropicKeyChange(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
              <button className={styles.showBtn} onClick={() => setShowKey(v => !v)}>
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>

            {/* Status display */}
            {edStyleStatus === 'analyzing' && (
              <div className={styles.analyzing}>
                <span className={styles.dot} />
                Analyzing style…
              </div>
            )}
            {edStyleStatus === 'ready' && edStyleParams && (
              <div className={styles.resolved}>{fmtParams(edStyleParams)}</div>
            )}
            {edStyleStatus === 'idle' && !anthropicKey && (
              <div className={styles.hint}>
                No API key — defaults will be applied (Rate: -20% · Pitch: -10% · Break: 900ms)
              </div>
            )}
          </div>

          {/* ── Voice ─────────────────────────────────────── */}
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
                  <option key={v.name} value={v.name}>{shortName(v.name)}</option>
                ))
              )}
            </select>

            <div className={styles.voiceList}>
              {MEDITATION_VOICES.map(mv => {
                const available = loadedNames.has(mv.full);
                const active    = selectedVoice === mv.full;
                return (
                  <button
                    key={mv.full}
                    className={`${styles.voiceItem} ${active ? styles.active : ''} ${!available ? styles.unavailable : ''}`}
                    onClick={() => available && onVoiceChange(mv.full)}
                    title={available ? undefined : 'Not available in this browser'}
                  >
                    <span className={styles.voiceItemTop}>
                      <span className={styles.voiceItemName}>{mv.label}</span>
                      <span className={styles.voiceItemLang}>{mv.lang}</span>
                      {mv.best && <span className={styles.voiceItemBadge}>✅</span>}
                    </span>
                    <span className={styles.voiceItemDesc}>{mv.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Sliders ───────────────────────────────────── */}
          <div className={styles.sliders}>
            <div className={styles.sliderGroup}>
              <div className={styles.sliderHeader}>
                <span>Speed</span>
                <strong>{rate.toFixed(2)}x</strong>
              </div>
              <input
                type="range" className={styles.slider}
                min="0.5" max="1.5" step="0.05"
                value={rate}
                onChange={e => onRateChange(parseFloat(e.target.value))}
              />
              <div className={styles.ticks}><span>0.5×</span><span>1.0×</span><span>1.5×</span></div>
            </div>

            <div className={styles.sliderGroup}>
              <div className={styles.sliderHeader}>
                <span>Pitch</span>
                <strong>{pitch.toFixed(2)}</strong>
              </div>
              <input
                type="range" className={styles.slider}
                min="0.5" max="1.5" step="0.05"
                value={pitch}
                onChange={e => onPitchChange(parseFloat(e.target.value))}
              />
              <div className={styles.ticks}><span>Low</span><span>Mid</span><span>High</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
