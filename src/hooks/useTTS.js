import { useCallback, useEffect, useRef, useState } from 'react';

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

// ── Edge TTS voice priority (deep male first) ─────────────────
export const EDGE_VOICE_PRIORITY = [
  'Microsoft Guy Online (Natural) - English (United States)',
  'Microsoft Davis Online (Natural) - English (United States)',
  'Microsoft Tony Online (Natural) - English (United States)',
  'Microsoft Jason Online (Natural) - English (United States)',
  'Microsoft Eric Online (Natural) - English (United States)',
  'Microsoft Andrew Online (Natural) - English (United States)',
  'Microsoft Brian Online (Natural) - English (United States)',
  'Microsoft Christopher Online (Natural) - English (United States)',
  'Microsoft Roger Online (Natural) - English (United States)',
  'Microsoft Steffan Online (Natural) - English (United States)',
  'Microsoft Andrew Multilingual Online (Natural) - English (United States)',
  'Microsoft Brian Multilingual Online (Natural) - English (United States)',
  'Microsoft Ryan Online (Natural) - English (United Kingdom)',
  'Microsoft Thomas Online (Natural) - English (United Kingdom)',
  'Microsoft William Online (Natural) - English (Australia)',
];

// ── Edge style defaults (used when no Anthropic key / as fallback) ──
export const EDGE_STYLE_DEFAULTS = {
  rate:                 '-20%',
  pitch:                '-10%',
  volume:               '+0%',
  breakBetweenSentences:'900ms',
  emphasis:             'moderate',
};

export const EDGE_DEFAULT_STYLE_PROMPT =
  'Speak slowly and deeply, like a hypnotherapist guiding someone into relaxation. ' +
  'Pause slightly between sentences. Use a calm, authoritative tone.';

// ── localStorage helpers ──────────────────────────────────────
const LS = {
  ENGINE:          'tts_engine',
  EL_VOICES:       'tts_el_voices',
  EL_SELECTED:     'tts_el_selected',
  EL_APIKEY:       'tts_el_apikey',
  EL_RATE:         'tts_el_rate',
  EL_PITCH:        'tts_el_pitch',
  G_APIKEY:        'tts_g_apikey',
  G_VOICE:         'tts_g_voice',
  G_PROMPT:        'tts_g_prompt',
  G_PITCH:         'tts_g_pitch',
  G_RATE:          'tts_g_rate',
  ED_VOICE:        'tts_ed_voice',
  ED_RATE:         'tts_ed_rate',
  ED_PITCH:        'tts_ed_pitch',
  ED_STYLE_PROMPT: 'tts_ed_style_prompt',
  ANTHROPIC_KEY:   'tts_anthropic_key',
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

  const data  = await resp.json();
  const bytes = Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0));
  return new Blob([bytes], { type: 'audio/mp3' });
}

// ── Edge SSML helpers ─────────────────────────────────────────

function parseBreakMs(str) {
  if (!str) return 900;
  const ms = str.match(/^(\d+(?:\.\d+)?)ms$/i);
  if (ms) return parseFloat(ms[1]);
  const s  = str.match(/^(\d+(?:\.\d+)?)s$/i);
  if (s)  return parseFloat(s[1]) * 1000;
  return 900;
}

function ssmlRateToNum(rateStr) {
  const m = rateStr?.match(/^([+-]?\d+(?:\.\d+)?)%$/);
  if (!m) return 1.0;
  return Math.max(0.1, 1.0 + parseFloat(m[1]) / 100);
}

function ssmlPitchToNum(pitchStr) {
  const m = pitchStr?.match(/^([+-]?\d+(?:\.\d+)?)%$/);
  if (!m) return 1.0;
  return Math.max(0, Math.min(2, 1.0 + parseFloat(m[1]) / 100));
}

async function resolveEdgeStyle(prompt, apiKey) {
  if (!apiKey || !prompt.trim()) return { ...EDGE_STYLE_DEFAULTS };

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{
        role:    'user',
        content: `Convert this voice style instruction into SSML speech parameters. Return ONLY a JSON object, no explanation, no markdown.\nInstruction: '${prompt}'\n\nReturn this exact JSON structure:\n{\n  "rate": "-20%",\n  "pitch": "-10%",\n  "volume": "+0%",\n  "breakBetweenSentences": "900ms",\n  "emphasis": "moderate"\n}`,
      }],
    }),
  });

  if (!resp.ok) throw new Error(`Anthropic API error ${resp.status}`);

  const data = await resp.json();
  const raw  = data.content[0].text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  return { ...EDGE_STYLE_DEFAULTS, ...JSON.parse(raw) };
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
  const [engine,          setEngineState]       = useState(() => lsStr(LS.ENGINE, 'elevenlabs'));

  // ElevenLabs state
  const [elVoices,        setElVoicesState]     = useState(() => lsGet(LS.EL_VOICES,   EL_DEFAULT_VOICES));
  const [elSelected,      setElSelectedState]   = useState(() => lsGet(LS.EL_SELECTED, EL_DEFAULT_VOICES[0]));
  const [elApiKey,        setElApiKeyState]     = useState(() => lsStr(LS.EL_APIKEY));
  const [elRate,          setElRateState]       = useState(() => lsGet(LS.EL_RATE,   0.75));
  const [elPitch,         setElPitchState]      = useState(() => lsGet(LS.EL_PITCH,  0.8));

  // Google state
  const [gApiKey,         setGApiKeyState]      = useState(() => lsStr(LS.G_APIKEY));
  const [gVoice,          setGVoiceState]       = useState(() => lsStr(LS.G_VOICE, GOOGLE_VOICES[0].name));
  const [gPrompt,         setGPromptState]      = useState(() => lsStr(LS.G_PROMPT) || DEFAULT_STYLE_PROMPT);
  const [gPitch,          setGPitchState]       = useState(() => lsGet(LS.G_PITCH,  -2));
  const [gRate,           setGRateState]        = useState(() => lsGet(LS.G_RATE,   0.85));

  // Edge TTS state
  const [edVoices,        setEdVoices]          = useState([]);
  const [edVoice,         setEdVoiceState]      = useState(() => lsStr(LS.ED_VOICE, ''));
  const [edRate,          setEdRateState]       = useState(() => lsGet(LS.ED_RATE,  0.8));
  const [edPitch,         setEdPitchState]      = useState(() => lsGet(LS.ED_PITCH, 0.9));
  const [edWarn,          setEdWarn]            = useState('');
  const [edStylePrompt,   setEdStylePromptState]= useState(() => lsStr(LS.ED_STYLE_PROMPT) || EDGE_DEFAULT_STYLE_PROMPT);
  const [anthropicKey,    setAnthropicKeyState] = useState(() => lsStr(LS.ANTHROPIC_KEY));
  const [edStyleParams,   setEdStyleParams]     = useState({ ...EDGE_STYLE_DEFAULTS });
  const [edStyleStatus,   setEdStyleStatus]     = useState('idle'); // 'idle' | 'analyzing' | 'ready'

  // Playback state
  const [status,          setStatus]            = useState('idle');
  const [activeIndex,     setActiveIndex]       = useState(-1);
  const [chunkProgress,   setChunkProgress]     = useState({ done: 0, total: 0 });
  const [countdown,       setCountdown]         = useState(null);
  const [chunks,          setChunks]            = useState([]);
  const [error,           setError]             = useState(null);

  // ── Mutable refs ──────────────────────────────────────────
  const playing          = useRef(false);
  const paused           = useRef(false);
  const chunkIdx         = useRef(0);
  const chunksRef        = useRef([]);
  const gapTimer         = useRef(null);
  const countdownInt     = useRef(null);
  const skipRef          = useRef(false);
  const countdownRem     = useRef(0);
  const fetchAbort       = useRef(null);
  const currentAudio     = useRef(null);
  const pausedAudio      = useRef(null);
  const currentUtterance = useRef(null);
  const pendingNext      = useRef(null);
  const playFromRef      = useRef(null);
  const styleParamsRef   = useRef(null);   // session cache for resolved SSML params
  const styleCacheKeyRef = useRef('');     // tracks prompt+key used for cache

  // Reflected-value refs (avoid stale closures inside async callbacks)
  const engineRef        = useRef(engine);
  const elSelRef         = useRef(elSelected);
  const elApiRef         = useRef(elApiKey);
  const elRateRef        = useRef(elRate);
  const elPitchRef       = useRef(elPitch);
  const gApiRef          = useRef(gApiKey);
  const gVoiceRef        = useRef(gVoice);
  const gPromptRef       = useRef(gPrompt);
  const gPitchRef        = useRef(gPitch);
  const gRateRef         = useRef(gRate);
  const edVoiceRef       = useRef(edVoice);
  const edVoicesRef      = useRef(edVoices);
  const edRateRef        = useRef(edRate);
  const edPitchRef       = useRef(edPitch);
  const edStylePromptRef = useRef(edStylePrompt);
  const anthropicKeyRef  = useRef(anthropicKey);

  engineRef.current        = engine;
  elSelRef.current         = elSelected;
  elApiRef.current         = elApiKey;
  elRateRef.current        = elRate;
  elPitchRef.current       = elPitch;
  gApiRef.current          = gApiKey;
  gVoiceRef.current        = gVoice;
  gPromptRef.current       = gPrompt;
  gPitchRef.current        = gPitch;
  gRateRef.current         = gRate;
  edVoiceRef.current       = edVoice;
  edVoicesRef.current      = edVoices;
  edRateRef.current        = edRate;
  edPitchRef.current       = edPitch;
  edStylePromptRef.current = edStylePrompt;
  anthropicKeyRef.current  = anthropicKey;

  // ── Load Edge voices on mount ──────────────────────────────
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return;

    function load() {
      const all     = speechSynthesis.getVoices();
      if (all.length === 0) return;
      const natural = all.filter(v => v.name.includes('Online (Natural)'));

      if (natural.length === 0) {
        setEdWarn('No Microsoft neural voices found. Open this page in Microsoft Edge for the best results.');
        setEdVoices([]);
        return;
      }

      setEdWarn('');
      const sorted = [...natural].sort((a, b) => {
        const ai = EDGE_VOICE_PRIORITY.indexOf(a.name);
        const bi = EDGE_VOICE_PRIORITY.indexOf(b.name);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.name.localeCompare(b.name);
      });
      setEdVoices(sorted);
      setEdVoiceState(prev => {
        if (prev && sorted.some(v => v.name === prev)) return prev;
        const def = sorted[0]?.name ?? '';
        lsSetStr(LS.ED_VOICE, def);
        return def;
      });
    }

    load();
    speechSynthesis.addEventListener('voiceschanged', load);
    return () => speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

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
  const setEdVoice  = useCallback((v) => { setEdVoiceState(v);  lsSetStr(LS.ED_VOICE, v); }, []);
  const setEdRate   = useCallback((v) => { setEdRateState(v);   lsSet(LS.ED_RATE,  v); }, []);
  const setEdPitch  = useCallback((v) => { setEdPitchState(v);  lsSet(LS.ED_PITCH, v); }, []);

  // Invalidate style cache when prompt or API key changes
  const setEdStylePrompt = useCallback((p) => {
    setEdStylePromptState(p);
    lsSetStr(LS.ED_STYLE_PROMPT, p);
    styleParamsRef.current = null;
  }, []);

  const setAnthropicKey = useCallback((k) => {
    setAnthropicKeyState(k);
    lsSetStr(LS.ANTHROPIC_KEY, k);
    styleParamsRef.current = null;
  }, []);

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

  // ── Audio / utterance teardown ─────────────────────────────

  function killAudio() {
    for (const ref of [currentAudio, pausedAudio]) {
      if (ref.current) { ref.current.pause(); ref.current.src = ''; ref.current = null; }
    }
    try { speechSynthesis.cancel(); } catch {}
    currentUtterance.current = null;
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

    // ── Edge TTS (Web Speech API) path ───────────────────────
    if (engineRef.current === 'edge') {
      const params  = styleParamsRef.current ?? EDGE_STYLE_DEFAULTS;
      const voice   = edVoicesRef.current.find(v => v.name === edVoiceRef.current) ?? null;
      const breakMs = parseBreakMs(params.breakBetweenSentences);

      const utt = new SpeechSynthesisUtterance(chunk.text);
      if (voice) utt.voice = voice;
      utt.rate  = ssmlRateToNum(params.rate);
      utt.pitch = ssmlPitchToNum(params.pitch);
      currentUtterance.current = utt;

      utt.onend = () => {
        currentUtterance.current = null;
        if (!playing.current) return;
        pendingNext.current = index + 1;
        if (paused.current) return;
        gapTimer.current = setTimeout(() => {
          if (!playing.current || paused.current) return;
          const next = pendingNext.current;
          pendingNext.current = null;
          if (next !== null) playFromRef.current(next);
        }, breakMs);
      };

      utt.onerror = (e) => {
        currentUtterance.current = null;
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        if (playing.current && !paused.current) playFromRef.current(index + 1);
      };

      if (!paused.current) speechSynthesis.speak(utt);
      return;
    }

    // ── Fetch TTS (ElevenLabs / Google) path ─────────────────
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

    if (!playing.current) return;

    const url   = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio.current = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio.current = null;
      if (!playing.current) return;

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

    if (engineRef.current === 'edge') {
      const cacheKey = `${anthropicKeyRef.current}||${edStylePromptRef.current}`;
      if (styleParamsRef.current && styleCacheKeyRef.current === cacheKey) {
        // Cache hit — start immediately
        setTimeout(() => playFromRef.current(0), 100);
      } else {
        // Resolve style via Claude (or use defaults if no key)
        setEdStyleStatus('analyzing');
        resolveEdgeStyle(edStylePromptRef.current, anthropicKeyRef.current)
          .then(params => {
            styleParamsRef.current   = params;
            styleCacheKeyRef.current = cacheKey;
            setEdStyleParams(params);
            setEdStyleStatus('ready');
            if (playing.current) setTimeout(() => playFromRef.current(0), 100);
          })
          .catch(() => {
            const fallback = { ...EDGE_STYLE_DEFAULTS };
            styleParamsRef.current   = fallback;
            styleCacheKeyRef.current = cacheKey;
            setEdStyleParams(fallback);
            setEdStyleStatus('ready');
            if (playing.current) setTimeout(() => playFromRef.current(0), 100);
          });
      }
      return;
    }

    setTimeout(() => playFromRef.current(0), 100);
  }, [stopCountdown]);

  const pause = useCallback(() => {
    if (!playing.current || paused.current) return;
    paused.current = true;
    clearTimeout(gapTimer.current);
    if (countdownInt.current) { clearInterval(countdownInt.current); countdownInt.current = null; }

    if (engineRef.current === 'edge') {
      try { speechSynthesis.pause(); } catch {}
    } else {
      fetchAbort.current?.abort();
      if (currentAudio.current && !currentAudio.current.paused) {
        currentAudio.current.pause();
        pausedAudio.current  = currentAudio.current;
        currentAudio.current = null;
      }
    }

    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    if (!paused.current) return;
    paused.current = false;
    setStatus('playing');

    if (countdownRem.current > 0 && countdown !== null) {
      startCountdown(countdownRem.current, () => {
        if (playing.current) playFromRef.current(chunkIdx.current + 1);
      });
      return;
    }

    if (pendingNext.current !== null) {
      const next = pendingNext.current;
      pendingNext.current = null;
      gapTimer.current = setTimeout(() => {
        if (playing.current && !paused.current) playFromRef.current(next);
      }, 1000);
      return;
    }

    if (engineRef.current === 'edge') {
      try { speechSynthesis.resume(); } catch {}
      return;
    }

    if (pausedAudio.current) {
      currentAudio.current = pausedAudio.current;
      pausedAudio.current  = null;
      currentAudio.current.play().catch(() => {});
      return;
    }

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
    if (edStyleStatus === 'analyzing') setEdStyleStatus('idle');
  }, [stopCountdown, edStyleStatus]);

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
    // Edge
    edVoices, edVoice, edRate, edPitch, edWarn,
    setEdVoice, setEdRate, setEdPitch,
    edStylePrompt, setEdStylePrompt,
    anthropicKey,  setAnthropicKey,
    edStyleParams, edStyleStatus,
    // Playback
    status, activeIndex, chunkProgress, countdown, chunks, error,
    play, pause, resume, stop, skipPause,
  };
}
