import { useCallback, useRef, useState } from 'react';

// ── ElevenLabs defaults ───────────────────────────────────────
export const EL_DEFAULT_VOICES = [
  { name: 'Adam',    id: 'pNInz6obpgDQGcFmaJgB' },
  { name: 'Clyde',   id: '2EiwWnXFnvU5JabPnv8n' },
  { name: 'Arnold',  id: 'VR6AewLTigWG4xSOukaG' },
  { name: 'Antoni',  id: 'ErXwobaYiN019PkySvjV'  },
  { name: 'Daniel',  id: 'onwK4e9ZLuTAKqWW03F9'  },
  { name: 'Patrick', id: 'ODq5zmih8GrVes37Dy39'  },
];

// ── Google Gemini TTS voices ──────────────────────────────────
export const GOOGLE_VOICES = [
  { name: 'Umbriel',  desc: 'default'         },
  { name: 'Achernar', desc: 'deep, warm'      },
  { name: 'Charon',   desc: 'dark, powerful'  },
  { name: 'Fenrir',   desc: 'strong, nordic'  },
  { name: 'Orus',     desc: 'deep, calm'      },
  { name: 'Sulafat',  desc: 'smooth, mellow'  },
];

export const DEFAULT_STYLE_PROMPT =
  'Speak in a slow, deep, hypnotic tone like a calm hypnotherapist. ' +
  'Pause naturally between thoughts. Sound warm, grounded, and authoritative.';

// ── localStorage helpers ──────────────────────────────────────
const LS = {
  ENGINE:      'tts_engine',
  EL_VOICES:   'tts_el_voices',
  EL_SELECTED: 'tts_el_selected',
  EL_APIKEY:   'tts_el_apikey',
  EL_RATE:     'tts_el_rate',
  EL_PITCH:    'tts_el_pitch',
  G_APIKEY:    'tts_g_apikey',
  G_VOICE:     'tts_g_voice',
  G_PROMPT:    'tts_g_prompt',
  G_PITCH:     'tts_g_pitch',
  G_RATE:      'tts_g_rate',
};

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsStr(key, fallback = '') { return localStorage.getItem(key) ?? fallback; }
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function lsSetStr(key, val) { try { localStorage.setItem(key, val); } catch {} }

// ── ElevenLabs TTS fetch ──────────────────────────────────────
async function fetchElevenLabs(text, voiceId, apiKey, rate, stability, signal) {
  if (!apiKey)   throw new Error('No ElevenLabs API key — add it in the Voice Manager.');
  if (!voiceId)  throw new Error('No ElevenLabs voice selected.');

  const resp = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      signal,
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability:        Math.max(0, Math.min(1, stability)),
          similarity_boost: 0.75,
          speed:            Math.max(0.7, Math.min(1.2, rate)),
        },
      }),
    }
  );

  if (!resp.ok) {
    let msg = `ElevenLabs error ${resp.status}`;
    try { const j = await resp.json(); msg = j.detail?.message ?? j.detail ?? j.message ?? msg; } catch {}
    throw new Error(msg);
  }
  return resp.blob();
}

// ── Google Gemini TTS fetch ───────────────────────────────────
async function fetchGoogle(text, voiceName, apiKey, stylePrompt, pitch, speakingRate, signal) {
  if (!apiKey) throw new Error('No Google API key — add it in the Voice Manager.');

  const resp = await fetch(
    'https://texttospeech.googleapis.com/v1beta1/text:synthesize',
    {
      method: 'POST',
      signal,
      headers: {
        'X-Goog-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioConfig: { audioEncoding: 'MP3', pitch, speakingRate },
        input:       { prompt: stylePrompt, text },
        voice:       { languageCode: 'en-us', modelName: 'gemini-3.1-flash-tts-preview', name: voiceName },
      }),
    }
  );

  if (!resp.ok) {
    let msg = `Google TTS error ${resp.status}`;
    if      (resp.status === 403) msg = 'Invalid Google API key or API not enabled.';
    else if (resp.status === 429) msg = 'Google quota exceeded.';
    else { try { const j = await resp.json(); msg = j.error?.message ?? msg; } catch {} }
    throw new Error(msg);
  }

  const data   = await resp.json();
  const bytes  = Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0));
  return new Blob([bytes], { type: 'audio/mp3' });
}

// ── Text → chunks ─────────────────────────────────────────────
function buildChunks(raw) {
  const parts = raw.split(/(\[PAUSE:\d+(?:\.\d+)?\])/i);
  const result = [];
  let sentIdx = 0;
  for (const part of parts) {
    const m = part.match(/^\[PAUSE:(\d+(?:\.\d+)?)\]$/i);
    if (m) { result.push({ type: 'pause', minutes: parseFloat(m[1]) }); continue; }
    const sentences = part.split(/(?<=[.!?])\s+|(?<=[.!?])$/).map(s => s.trim()).filter(Boolean);
    for (const text of sentences) result.push({ type: 'speak', text, index: sentIdx++ });
  }
  return result;
}

// ── Hook ──────────────────────────────────────────────────────
export function useTTS() {
  // Engine toggle
  const [engine,      setEngineState] = useState(() => lsStr(LS.ENGINE, 'elevenlabs'));

  // ElevenLabs state
  const [elVoices,    setElVoicesState]  = useState(() => lsGet(LS.EL_VOICES,   EL_DEFAULT_VOICES));
  const [elSelected,  setElSelectedState]= useState(() => lsGet(LS.EL_SELECTED, EL_DEFAULT_VOICES[0]));
  const [elApiKey,    setElApiKeyState]  = useState(() => lsStr(LS.EL_APIKEY));
  const [elRate,      setElRateState]    = useState(() => lsGet(LS.EL_RATE,   0.75));
  const [elPitch,     setElPitchState]   = useState(() => lsGet(LS.EL_PITCH,  0.8));

  // Google state
  const [gApiKey,     setGApiKeyState]   = useState(() => lsStr(LS.G_APIKEY));
  const [gVoice,      setGVoiceState]    = useState(() => lsStr(LS.G_VOICE, GOOGLE_VOICES[0].name));
  const [gPrompt,     setGPromptState]   = useState(() => lsStr(LS.G_PROMPT) || DEFAULT_STYLE_PROMPT);
  const [gPitch,      setGPitchState]    = useState(() => lsGet(LS.G_PITCH,  -2));
  const [gRate,       setGRateState]     = useState(() => lsGet(LS.G_RATE,   0.85));

  // Playback state
  const [status,        setStatus]        = useState('idle');
  const [activeIndex,   setActiveIndex]   = useState(-1);
  const [chunkProgress, setChunkProgress] = useState({ done: 0, total: 0 });
  const [countdown,     setCountdown]     = useState(null);
  const [chunks,        setChunks]        = useState([]);
  const [error,         setError]         = useState(null);

  // ── Mutable refs ──────────────────────────────────────────
  const playing      = useRef(false);
  const paused       = useRef(false);
  const chunkIdx     = useRef(0);
  const chunksRef    = useRef([]);
  const gapTimer     = useRef(null);
  const countdownInt = useRef(null);
  const skipRef      = useRef(false);
  const countdownRem = useRef(0);
  const fetchAbort   = useRef(null);
  const currentAudio = useRef(null);  // Audio playing right now
  const pausedAudio  = useRef(null);  // Audio paused mid-sentence
  const pendingNext  = useRef(null);  // next chunk index after sentence ends + gap
  const playFromRef  = useRef(null);  // self-ref for async recursion

  // Reflected-value refs (avoid stale closures inside async playFrom)
  const engineRef    = useRef(engine);
  const elSelRef     = useRef(elSelected);
  const elApiRef     = useRef(elApiKey);
  const elRateRef    = useRef(elRate);
  const elPitchRef   = useRef(elPitch);
  const gApiRef      = useRef(gApiKey);
  const gVoiceRef    = useRef(gVoice);
  const gPromptRef   = useRef(gPrompt);
  const gPitchRef    = useRef(gPitch);
  const gRateRef     = useRef(gRate);

  engineRef.current  = engine;
  elSelRef.current   = elSelected;
  elApiRef.current   = elApiKey;
  elRateRef.current  = elRate;
  elPitchRef.current = elPitch;
  gApiRef.current    = gApiKey;
  gVoiceRef.current  = gVoice;
  gPromptRef.current = gPrompt;
  gPitchRef.current  = gPitch;
  gRateRef.current   = gRate;

  // ── Setters (with localStorage sync) ─────────────────────

  const setEngine = useCallback((e) => {
    setEngineState(e);
    lsSetStr(LS.ENGINE, e);
  }, []);

  const setElApiKey = useCallback((k) => { setElApiKeyState(k); lsSetStr(LS.EL_APIKEY, k); }, []);
  const setGApiKey  = useCallback((k) => { setGApiKeyState(k);  lsSetStr(LS.G_APIKEY,  k); }, []);
  const setGVoice   = useCallback((v) => { setGVoiceState(v);   lsSetStr(LS.G_VOICE,   v); }, []);
  const setGPrompt  = useCallback((p) => { setGPromptState(p);  lsSetStr(LS.G_PROMPT,  p); }, []);
  const setElRate   = useCallback((v) => { setElRateState(v);   lsSet(LS.EL_RATE,  v); }, []);
  const setElPitch  = useCallback((v) => { setElPitchState(v);  lsSet(LS.EL_PITCH, v); }, []);
  const setGPitch   = useCallback((v) => { setGPitchState(v);   lsSet(LS.G_PITCH,  v); }, []);
  const setGRate    = useCallback((v) => { setGRateState(v);    lsSet(LS.G_RATE,   v); }, []);

  const selectElVoice = useCallback((v) => {
    setElSelectedState(v);
    lsSet(LS.EL_SELECTED, v);
  }, []);

  const addElVoice = useCallback((v) => {
    setElVoicesState(prev => {
      const next = [...prev, v];
      lsSet(LS.EL_VOICES, next);
      return next;
    });
  }, []);

  const removeElVoice = useCallback((id) => {
    setElVoicesState(prev => {
      const next = prev.filter(v => v.id !== id);
      lsSet(LS.EL_VOICES, next);
      if (elSelRef.current?.id === id) {
        const fallback = next[0] ?? null;
        setElSelectedState(fallback);
        lsSet(LS.EL_SELECTED, fallback);
      }
      return next;
    });
  }, []);

  // ── Countdown helpers ──────────────────────────────────────

  const stopCountdown = useCallback(() => {
    clearInterval(countdownInt.current);
    countdownInt.current = null;
    setCountdown(null);
  }, []);

  const startCountdown = useCallback((totalSec, onDone) => {
    skipRef.current = false;
    countdownRem.current = totalSec;
    setCountdown({ remaining: totalSec, total: totalSec });

    function tick() {
      if (skipRef.current || countdownRem.current <= 0) {
        clearInterval(countdownInt.current);
        countdownInt.current = null;
        setCountdown(null);
        onDone();
        return;
      }
      countdownRem.current -= 1;
      setCountdown({ remaining: countdownRem.current, total: totalSec });
    }
    countdownInt.current = setInterval(tick, 1000);
  }, [stopCountdown]);

  // ── Audio teardown ─────────────────────────────────────────

  function killAudio() {
    for (const ref of [currentAudio, pausedAudio]) {
      if (ref.current) { ref.current.pause(); ref.current.src = ''; ref.current = null; }
    }
  }

  // ── Core: play chunk at index (async) ─────────────────────

  const playFrom = useCallback(async (index) => {
    if (!playing.current) return;

    chunkIdx.current = index;
    const all = chunksRef.current;

    if (index >= all.length) {
      playing.current = false;
      paused.current  = false;
      setStatus('idle');
      setActiveIndex(-1);
      const sp = all.filter(c => c.type === 'speak');
      setChunkProgress({ done: sp.length, total: sp.length });
      return;
    }

    const chunk = all[index];
    const done  = all.slice(0, index).filter(c => c.type === 'speak').length;
    const total = all.filter(c => c.type === 'speak').length;
    setChunkProgress({ done, total });

    if (chunk.type === 'pause') {
      setActiveIndex(-1);
      startCountdown(Math.round(chunk.minutes * 60), () => {
        if (playing.current) playFromRef.current(index + 1);
      });
      return;
    }

    setActiveIndex(chunk.index);

    const abort = new AbortController();
    fetchAbort.current = abort;

    let blob;
    try {
      blob = engineRef.current === 'google'
        ? await fetchGoogle(
            chunk.text, gVoiceRef.current, gApiRef.current,
            gPromptRef.current, gPitchRef.current, gRateRef.current,
            abort.signal
          )
        : await fetchElevenLabs(
            chunk.text, elSelRef.current?.id ?? '', elApiRef.current,
            elRateRef.current, elPitchRef.current,
            abort.signal
          );
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message);
      playing.current = false;
      paused.current  = false;
      setStatus('idle');
      return;
    }

    if (!playing.current) return; // stopped while fetching

    const url   = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio.current = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio.current = null;
      if (!playing.current) return;

      // Record next index — either fires the gap timer now or waits for resume
      pendingNext.current = index + 1;
      if (paused.current) return;

      gapTimer.current = setTimeout(() => {
        if (!playing.current || paused.current) return;
        const next = pendingNext.current;
        pendingNext.current = null;
        if (next !== null) playFromRef.current(next);
      }, 1000);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      currentAudio.current = null;
      if (playing.current && !paused.current) playFromRef.current(index + 1);
    };

    if (paused.current) {
      // Fetch finished while paused — hold audio for resume
      pausedAudio.current = audio;
    } else {
      audio.play().catch(() => {
        URL.revokeObjectURL(url);
        if (playing.current) playFromRef.current(index + 1);
      });
    }
  }, [startCountdown]);

  playFromRef.current = playFrom;

  // ── Public actions ─────────────────────────────────────────

  const play = useCallback((rawText) => {
    setError(null);
    fetchAbort.current?.abort();
    killAudio();
    clearTimeout(gapTimer.current);
    stopCountdown();
    pendingNext.current  = null;
    countdownRem.current = 0;

    const built = buildChunks(rawText);
    chunksRef.current = built;
    setChunks(built);
    chunkIdx.current = 0;
    playing.current  = true;
    paused.current   = false;
    setStatus('playing');
    setActiveIndex(-1);

    setTimeout(() => playFromRef.current(0), 100);
  }, [stopCountdown]);

  const pause = useCallback(() => {
    if (!playing.current || paused.current) return;
    paused.current = true;
    fetchAbort.current?.abort();    // abort in-flight fetch; re-fetched on resume
    clearTimeout(gapTimer.current); // pendingNext stays set if audio already ended

    if (currentAudio.current && !currentAudio.current.paused) {
      currentAudio.current.pause();
      pausedAudio.current  = currentAudio.current;
      currentAudio.current = null;
    }

    if (countdownInt.current) { clearInterval(countdownInt.current); countdownInt.current = null; }
    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    if (!paused.current) return;
    paused.current = false;
    setStatus('playing');

    // Mid-countdown: restart it from where it left off
    if (countdownRem.current > 0 && countdown !== null) {
      startCountdown(countdownRem.current, () => {
        if (playing.current) playFromRef.current(chunkIdx.current + 1);
      });
      return;
    }

    // Audio ended while paused: fire gap timer then advance
    if (pendingNext.current !== null) {
      const next = pendingNext.current;
      pendingNext.current = null;
      gapTimer.current = setTimeout(() => {
        if (playing.current && !paused.current) playFromRef.current(next);
      }, 1000);
      return;
    }

    // Audio was paused mid-sentence: resume it
    if (pausedAudio.current) {
      currentAudio.current = pausedAudio.current;
      pausedAudio.current  = null;
      currentAudio.current.play().catch(() => {});
      return;
    }

    // Paused during fetch: re-fetch current chunk
    if (playing.current) playFromRef.current(chunkIdx.current);
  }, [countdown, startCountdown]);

  const stop = useCallback(() => {
    playing.current  = false;
    paused.current   = false;
    fetchAbort.current?.abort();
    killAudio();
    clearTimeout(gapTimer.current);
    stopCountdown();
    pendingNext.current  = null;
    countdownRem.current = 0;
    chunkIdx.current     = 0;
    setStatus('idle');
    setActiveIndex(-1);
    setChunkProgress({ done: 0, total: 0 });
    setChunks([]);
  }, [stopCountdown]);

  const skipPause = useCallback(() => { skipRef.current = true; }, []);

  return {
    // Engine
    engine, setEngine,
    // ElevenLabs
    elVoices, elSelected, elApiKey,
    addElVoice, removeElVoice, selectElVoice, setElApiKey,
    elRate, setElRate,
    elPitch, setElPitch,
    // Google
    gApiKey, gVoice, gPrompt, gPitch, gRate,
    setGApiKey, setGVoice, setGPrompt, setGPitch, setGRate,
    // Playback
    status, activeIndex, chunkProgress, countdown, chunks, error,
    play, pause, resume, stop, skipPause,
  };
}
