import { useState } from 'react';
import styles from './ElevenLabsPanel.module.scss';

export default function ElevenLabsPanel({
  voices, selectedVoice, apiKey,
  onVoiceSelect, onVoiceAdd, onVoiceRemove, onApiKeyChange,
}) {
  const [open,     setOpen]     = useState(false);
  const [localKey, setLocalKey] = useState(apiKey);
  const [showKey,  setShowKey]  = useState(false);
  const [newId,    setNewId]    = useState('');
  const [newName,  setNewName]  = useState('');
  const [fetching, setFetching] = useState(false);

  // Auto-fetch voice name from ElevenLabs when user leaves the ID field
  async function handleIdBlur() {
    const id = newId.trim();
    if (!id || newName || !localKey.trim()) return;
    setFetching(true);
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/voices/${id}`, {
        headers: { 'xi-api-key': localKey.trim() },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.name) setNewName(data.name);
      }
    } catch {}
    setFetching(false);
  }

  function handleAdd() {
    const id   = newId.trim();
    const name = newName.trim() || `Voice ${id.slice(0, 8)}`;
    if (!id) return;
    if (voices.some(v => v.id === id)) return; // no duplicates
    onVoiceAdd({ id, name });
    setNewId('');
    setNewName('');
  }

  function handleSaveKey() {
    onApiKeyChange(localKey.trim());
  }

  return (
    <div className={styles.wrap}>
      <button className={styles.toggle} onClick={() => setOpen(o => !o)}>
        <span>ElevenLabs Voice Manager</span>
        <span className={styles.arrow}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.panel}>

          {/* ── API key ── */}
          <section className={styles.section}>
            <p className={styles.sectionLabel}>API Key</p>
            <div className={styles.keyRow}>
              <input
                type={showKey ? 'text' : 'password'}
                className={styles.input}
                value={localKey}
                onChange={e => setLocalKey(e.target.value)}
                placeholder="sk-..."
                onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
              />
              <button className={styles.ghostBtn} onClick={() => setShowKey(s => !s)}>
                {showKey ? 'Hide' : 'Show'}
              </button>
              <button className={styles.primaryBtn} onClick={handleSaveKey}>
                Save
              </button>
            </div>
          </section>

          {/* ── Active voice dropdown ── */}
          <section className={styles.section}>
            <p className={styles.sectionLabel}>Active Voice</p>
            <select
              className={styles.select}
              value={selectedVoice?.id ?? ''}
              onChange={e => {
                const v = voices.find(v => v.id === e.target.value);
                if (v) onVoiceSelect(v);
              }}
            >
              {voices.length === 0 && <option value="">No voices — add one below</option>}
              {voices.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </section>

          {/* ── Add voice ── */}
          <section className={styles.section}>
            <p className={styles.sectionLabel}>Add Voice</p>
            <div className={styles.addGrid}>
              <input
                className={styles.input}
                value={newId}
                onChange={e => setNewId(e.target.value)}
                onBlur={handleIdBlur}
                placeholder="Paste ElevenLabs voice ID"
              />
              <input
                className={styles.input}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={fetching ? 'Fetching name…' : 'Display name (auto-filled)'}
                disabled={fetching}
              />
              <button
                className={styles.primaryBtn}
                onClick={handleAdd}
                disabled={!newId.trim()}
              >
                + Add
              </button>
            </div>
          </section>

          {/* ── Saved voices list ── */}
          {voices.length > 0 && (
            <section className={styles.section}>
              <p className={styles.sectionLabel}>Saved Voices</p>
              <ul className={styles.list}>
                {voices.map(v => (
                  <li
                    key={v.id}
                    className={`${styles.item} ${selectedVoice?.id === v.id ? styles.itemActive : ''}`}
                  >
                    <span className={styles.voiceName}>{v.name}</span>
                    <span className={styles.voiceId}>{v.id.slice(0, 14)}…</span>
                    <button
                      className={styles.removeBtn}
                      onClick={() => onVoiceRemove(v.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

        </div>
      )}
    </div>
  );
}
