import { useCallback, useRef, useState } from 'react';

// StreamElements free TTS API — returns real MP3, no auth required
const API_BASE = 'https://api.streamelements.com/kappa/v2/speech';
const API_VOICE = 'Brian'; // decent deep UK male voice
const CHUNK_CHARS = 240;   // safe limit per API call
const BATCH_SIZE = 4;      // parallel requests

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

// ── Fetch one chunk from the API ──────────────────────────────
async function fetchChunk(text, signal) {
  const url = `${API_BASE}?voice=${API_VOICE}&text=${encodeURIComponent(text)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`TTS API error ${res.status}`);
  return res.blob();
}

// ── Run fetches in parallel batches, preserving order ─────────
async function fetchAllChunks(chunks, batchSize, onProgress, signal) {
  const results = new Array(chunks.length);

  for (let i = 0; i < chunks.length; i += batchSize) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const batch = chunks.slice(i, i + batchSize);
    const batchBlobs = await Promise.all(
      batch.map(chunk => fetchChunk(chunk, signal))
    );

    for (let j = 0; j < batchBlobs.length; j++) {
      results[i + j] = batchBlobs[j];
    }

    onProgress(Math.min(i + batchSize, chunks.length));
  }

  return results;
}

// ── Trigger browser download ───────────────────────────────────
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Hook ──────────────────────────────────────────────────────
export function useDownload() {
  const [status,   setStatus]   = useState('idle');  // idle|loading|done|error
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error,    setError]    = useState(null);
  const abortCtrl = useRef(null);

  const download = useCallback(async (rawText) => {
    // Strip [PAUSE:N] markers; they can't be encoded in the API audio
    const clean = rawText
      .replace(/\[PAUSE:\d+(?:\.\d+)?\]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) return;

    // Cancel any previous run
    abortCtrl.current?.abort();
    const ctrl = new AbortController();
    abortCtrl.current = ctrl;

    setStatus('loading');
    setError(null);

    const chunks = splitIntoChunks(clean, CHUNK_CHARS);
    setProgress({ done: 0, total: chunks.length });

    try {
      const blobs = await fetchAllChunks(
        chunks,
        BATCH_SIZE,
        done => setProgress({ done, total: chunks.length }),
        ctrl.signal
      );

      // MP3 frames can be safely concatenated into one file
      const combined = new Blob(blobs, { type: 'audio/mpeg' });
      triggerDownload(combined, 'speech.mp3');

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
