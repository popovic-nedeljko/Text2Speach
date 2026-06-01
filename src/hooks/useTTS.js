import { useCallback, useEffect, useRef, useState } from 'react';

// ── Text → chunk array ────────────────────────────────────────
function buildChunks(raw) {
  const parts = raw.split(/(\[PAUSE:\d+(?:\.\d+)?\])/i);
  const result = [];
  let sentIdx = 0;

  for (const part of parts) {
    const m = part.match(/^\[PAUSE:(\d+(?:\.\d+)?)\]$/i);
    if (m) {
      result.push({ type: 'pause', minutes: parseFloat(m[1]) });
      continue;
    }
    const sentences = part
      .split(/(?<=[.!?])\s+|(?<=[.!?])$/)
      .map(s => s.trim())
      .filter(Boolean);
    for (const text of sentences) {
      result.push({ type: 'speak', text, index: sentIdx++ });
    }
  }
  return result;
}

// ── Microsoft Edge neural voice priority list ─────────────────
const PRIORITY_EXACT = [
  'microsoft guy online (natural) - english (united states)',
  'microsoft ryan online (natural) - english (united kingdom)',
  'microsoft eric online (natural) - english (united states)',
  'microsoft roger online (natural) - english (united kingdom)',
  'microsoft davis online (natural) - english (united states)',
];

// Known male first names in Microsoft neural voice catalogue
const MS_MALE_NAMES = [
  'guy', 'ryan', 'eric', 'roger', 'davis', 'andrew', 'christopher',
  'brandon', 'jacob', 'steffan', 'tony', 'william', 'jason', 'derek',
];

function pickVoice(voices) {
  // 1. Exact priority name match (case-insensitive)
  for (const p of PRIORITY_EXACT) {
    const v = voices.find(v => v.name.toLowerCase() === p);
    if (v) return v;
  }

  // 2. Any Online (Natural) with a male name or "male" tag
  const naturalMale = voices.find(v => {
    const n = v.name.toLowerCase();
    return n.includes('online (natural)') &&
      (n.includes('male') || MS_MALE_NAMES.some(m => n.split(/\W/).includes(m)));
  });
  if (naturalMale) return naturalMale;

  // 3. Any Online (Natural) voice
  const natural = voices.find(v => v.name.toLowerCase().includes('online (natural)'));
  if (natural) return natural;

  // 4. Any Microsoft voice
  const ms = voices.find(v => v.name.toLowerCase().includes('microsoft'));
  if (ms) return ms;

  // 5. Any English voice, then first available
  return voices.find(v => v.lang.startsWith('en')) ?? voices[0] ?? null;
}

export function hasNeuralVoices(voices) {
  return voices.some(v => v.name.toLowerCase().includes('online (natural)'));
}

// ── Hook ──────────────────────────────────────────────────────
export function useTTS() {
  const [status,        setStatus]        = useState('idle');
  const [activeIndex,   setActiveIndex]   = useState(-1);
  const [chunkProgress, setChunkProgress] = useState({ done: 0, total: 0 });
  const [countdown,     setCountdown]     = useState(null);
  const [voice,         setVoice]         = useState(null);
  const [allVoices,     setAllVoices]     = useState([]);
  const [rate,          setRate]          = useState(0.75);
  const [pitch,         setPitch]         = useState(0.8);
  const [chunks,        setChunks]        = useState([]);

  // Mutable refs — don't need to trigger re-renders
  const playing      = useRef(false);
  const paused       = useRef(false);
  const chunkIdx     = useRef(0);
  const chunksRef    = useRef([]);
  const gapTimer     = useRef(null);
  const countdownInt = useRef(null);
  const skipRef      = useRef(false);
  const countdownRem = useRef(0);
  const voiceRef     = useRef(null);   // avoids stale closure in playFrom
  const rateRef      = useRef(rate);
  const pitchRef     = useRef(pitch);

  voiceRef.current  = voice;
  rateRef.current   = rate;
  pitchRef.current  = pitch;

  // ── Voice loading with retry ──────────────────────────────
  useEffect(() => {
    if (!window.speechSynthesis) return;

    // Track whether the user has already manually selected a voice
    // (in that case auto-pick should not override their choice)
    let manuallySelected = false;

    function applyVoices(voices) {
      setAllVoices(voices);
      if (!manuallySelected) {
        setVoice(pickVoice(voices));
      }
    }

    function tryLoad(retriesLeft) {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        applyVoices(voices);
        return;
      }
      if (retriesLeft > 0) {
        setTimeout(() => tryLoad(retriesLeft - 1), 500);
      }
    }

    function onVoicesChanged() {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) applyVoices(voices);
    }

    tryLoad(3);
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
    };
  }, []);

  // Manual voice selection from dropdown (skips auto-pick on next reload)
  const selectVoice = useCallback((v) => {
    setVoice(v);
  }, []);

  // ── Chrome keep-alive (prevents ~15 s cutoff) ─────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (playing.current && !paused.current && window.speechSynthesis?.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10_000);
    return () => clearInterval(id);
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

  // ── Core: play chunk at index ──────────────────────────────
  const playFrom = useCallback((index) => {
    if (!playing.current) return;

    chunkIdx.current = index;
    const allChunks  = chunksRef.current;

    if (index >= allChunks.length) {
      playing.current = false;
      paused.current  = false;
      setStatus('idle');
      setActiveIndex(-1);
      const speakChunks = allChunks.filter(c => c.type === 'speak');
      setChunkProgress({ done: speakChunks.length, total: speakChunks.length });
      return;
    }

    const chunk = allChunks[index];
    const done  = allChunks.slice(0, index).filter(c => c.type === 'speak').length;
    const total = allChunks.filter(c => c.type === 'speak').length;
    setChunkProgress({ done, total });

    if (chunk.type === 'pause') {
      setActiveIndex(-1);
      const totalSec = Math.round(chunk.minutes * 60);
      startCountdown(totalSec, () => {
        if (playing.current) playFrom(index + 1);
      });
      return;
    }

    setActiveIndex(chunk.index);

    const utt  = new SpeechSynthesisUtterance(chunk.text);
    utt.rate   = rateRef.current;
    utt.pitch  = pitchRef.current;
    if (voiceRef.current) utt.voice = voiceRef.current;

    utt.onend = () => {
      if (!playing.current) return;
      gapTimer.current = setTimeout(() => {
        if (playing.current) playFrom(index + 1);
      }, 1000);
    };

    utt.onerror = (e) => {
      if (e.error === 'interrupted') return;
      if (playing.current) playFrom(index + 1);
    };

    window.speechSynthesis.speak(utt);
  // voiceRef/rateRef/pitchRef are refs — no need to list them as deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startCountdown]);

  // ── Public actions ────────────────────────────────────────
  const play = useCallback((rawText) => {
    window.speechSynthesis?.cancel();
    clearTimeout(gapTimer.current);
    clearInterval(countdownInt.current);
    stopCountdown();

    const built = buildChunks(rawText);
    chunksRef.current = built;
    setChunks(built);
    chunkIdx.current = 0;
    playing.current  = true;
    paused.current   = false;
    setStatus('playing');
    setActiveIndex(-1);

    setTimeout(() => playFrom(0), 150);
  }, [playFrom, stopCountdown]);

  const pause = useCallback(() => {
    if (!playing.current || paused.current) return;
    paused.current = true;
    window.speechSynthesis?.pause();
    clearTimeout(gapTimer.current);
    if (countdownInt.current) {
      clearInterval(countdownInt.current);
      countdownInt.current = null;
    }
    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    if (!paused.current) return;
    paused.current = false;
    setStatus('playing');

    if (countdownRem.current > 0 && countdown !== null) {
      const rem = countdownRem.current;
      startCountdown(rem, () => {
        if (playing.current) playFrom(chunkIdx.current + 1);
      });
    } else {
      window.speechSynthesis?.resume();
    }
  }, [countdown, playFrom, startCountdown]);

  const stop = useCallback(() => {
    playing.current = false;
    paused.current  = false;
    window.speechSynthesis?.cancel();
    clearTimeout(gapTimer.current);
    stopCountdown();
    countdownRem.current = 0;
    chunkIdx.current = 0;
    setStatus('idle');
    setActiveIndex(-1);
    setChunkProgress({ done: 0, total: 0 });
    setChunks([]);
  }, [stopCountdown]);

  const skipPause = useCallback(() => {
    skipRef.current = true;
  }, []);

  return {
    status,
    activeIndex,
    chunkProgress,
    countdown,
    voice,
    allVoices,
    selectVoice,
    rate, setRate,
    pitch, setPitch,
    chunks,
    play,
    pause,
    resume,
    stop,
    skipPause,
  };
}
