import { useCallback, useRef, useState } from 'react';

const API_BASE   = 'https://api.streamelements.com/kappa/v2/speech';
const API_VOICE  = 'Brian';
const CHUNK_CHARS = 240;
const BATCH_SIZE  = 4;
const TARGET_SR   = 22050; // WAV output sample rate (good quality, manageable file size)

// ── Parse text into typed segments ────────────────────────────
function parseSegments(raw) {
  const parts = raw.split(/(\[PAUSE:\d+(?:\.\d+)?\])/i);
  const segs = [];
  for (const part of parts) {
    const m = part.match(/^\[PAUSE:(\d+(?:\.\d+)?)\]$/i);
    if (m) {
      segs.push({ type: 'pause', minutes: parseFloat(m[1]) });
    } else {
      const text = part.replace(/\s+/g, ' ').trim();
      if (text) segs.push({ type: 'text', text });
    }
  }
  return segs;
}

// ── Split text into ≤CHUNK_CHARS segments at word boundaries ──
function splitIntoChunks(text, maxLen) {
  const words = text.split(/\s+/);
  const chunks = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLen && current.length > 0) {
      chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// ── Fetch one speech chunk as MP3 blob ─────────────────────────
async function fetchChunk(text, signal) {
  const url = `${API_BASE}?voice=${API_VOICE}&text=${encodeURIComponent(text)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`TTS API error ${res.status}`);
  return res.blob();
}

// ── Encode AudioBuffer → WAV blob (mono, 16-bit) ──────────────
function audioBufferToWav(buf) {
  const sr      = buf.sampleRate;
  const len     = buf.length;
  const ab      = new ArrayBuffer(44 + len * 2);
  const view    = new DataView(ab);
  const samples = buf.getChannelData(0);

  const ws = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); view.setUint32(4, 36 + len * 2, true);
  ws(8, 'WAVE'); ws(12, 'fmt ');
  view.setUint32(16, 16, true);   // PCM
  view.setUint16(20,  1, true);   // format = PCM
  view.setUint16(22,  1, true);   // mono
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * 2, true);
  view.setUint16(32,  2, true);
  view.setUint16(34, 16, true);
  ws(36, 'data'); view.setUint32(40, len * 2, true);

  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([ab], { type: 'audio/wav' });
}

// ── Trigger browser download ───────────────────────────────────
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Hook ──────────────────────────────────────────────────────
export function useDownload() {
  const [status,   setStatus]   = useState('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error,    setError]    = useState(null);
  const abortCtrl = useRef(null);

  const download = useCallback(async (rawText) => {
    const segments = parseSegments(rawText);
    if (!segments.length) return;

    abortCtrl.current?.abort();
    const ctrl = new AbortController();
    abortCtrl.current = ctrl;
    setStatus('loading');
    setError(null);

    // Pre-count all text chunks for progress bar
    const allChunks = segments
      .filter(s => s.type === 'text')
      .flatMap(s => splitIntoChunks(s.text, CHUNK_CHARS));
    setProgress({ done: 0, total: allChunks.length });

    try {
      // AudioContext used only for decoding MP3 blobs
      const audioCtx = new AudioContext();

      // Build timeline: [{startTime, audioBuffer}]
      const timeline = [];
      let currentTime = 0;
      let doneCount   = 0;

      for (const seg of segments) {
        if (ctrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');

        if (seg.type === 'pause') {
          // Advance time — OfflineAudioContext will render silence here naturally
          currentTime += seg.minutes * 60;
        } else {
          const chunks = splitIntoChunks(seg.text, CHUNK_CHARS);

          for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            if (ctrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');

            const batch = chunks.slice(i, i + BATCH_SIZE);
            const blobs = await Promise.all(batch.map(c => fetchChunk(c, ctrl.signal)));

            for (const blob of blobs) {
              const arrayBuf = await blob.arrayBuffer();
              const decoded  = await audioCtx.decodeAudioData(arrayBuf);
              timeline.push({ startTime: currentTime, buffer: decoded });
              currentTime += decoded.duration;
            }

            doneCount += batch.length;
            setProgress({ done: doneCount, total: allChunks.length });
          }
        }
      }

      await audioCtx.close();

      if (currentTime === 0 || timeline.length === 0) return;

      // Render all speech + silence into a single OfflineAudioContext
      const totalFrames = Math.ceil(currentTime * TARGET_SR);
      const offlineCtx  = new OfflineAudioContext(1, totalFrames, TARGET_SR);

      for (const { startTime, buffer } of timeline) {
        const src = offlineCtx.createBufferSource();
        src.buffer = buffer;
        // playbackRate = 1 → Web Audio API handles sample-rate conversion automatically
        src.connect(offlineCtx.destination);
        src.start(startTime);
      }

      const rendered = await offlineCtx.startRendering();
      const wav      = audioBufferToWav(rendered);
      triggerDownload(wav, 'speech.wav');

      setStatus('done');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      if (err.name === 'AbortError') {
        setStatus('idle');
      } else {
        setStatus('error');
        setError(err.message);
      }
    }
  }, []);

  const cancel = useCallback(() => {
    abortCtrl.current?.abort();
    setStatus('idle');
    setProgress({ done: 0, total: 0 });
    setError(null);
  }, []);

  return { status, progress, error, download, cancel };
}
