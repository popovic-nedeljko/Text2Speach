import { useRef, useState } from 'react';
import { useTTS } from './hooks/useTTS';
import { useDownload } from './hooks/useDownload';
import TextInput from './components/TextInput';
import ReadingView from './components/ReadingView';
import Controls from './components/Controls';
import ProgressBar from './components/ProgressBar';
import PauseOverlay from './components/PauseOverlay';
import Sliders from './components/Sliders';
import WarnBanner from './components/WarnBanner';
import DownloadButton from './components/DownloadButton';
import EngineToggle from './components/EngineToggle';
import ElevenLabsPanel from './components/ElevenLabsPanel';
import GooglePanel from './components/GooglePanel';
import EdgePanel from './components/EdgePanel';
import styles from './App.module.scss';

export default function App() {
  const [inputText, setInputText] = useState('');
  const inputRef = useRef(null);

  const tts = useTTS();
  const dl  = useDownload();
  const isReading = tts.status === 'playing' || tts.status === 'paused';

  function handlePlay() {
    const text = inputText.trim();
    if (!text) { inputRef.current?.focus(); return; }
    tts.play(text);
  }

  function handleEngineChange(e) {
    if (tts.status !== 'idle') tts.stop();
    tts.setEngine(e);
  }

  return (
    <div className={`${styles.app} ${tts.countdown ? styles.amberMode : ''}`}>
      <h1 className={styles.title}>
        Text to <span>Speech</span>
      </h1>

      <WarnBanner />

      <EngineToggle engine={tts.engine} onChange={handleEngineChange} />

      {isReading ? (
        <ReadingView chunks={tts.chunks} activeIndex={tts.activeIndex} />
      ) : (
        <TextInput
          ref={inputRef}
          value={inputText}
          onChange={setInputText}
        />
      )}

      <ProgressBar
        done={tts.chunkProgress.done}
        total={tts.chunkProgress.total}
        words={inputText.trim() ? inputText.trim().split(/\s+/).length : 0}
        chars={inputText.length}
      />

      {tts.countdown && (
        <PauseOverlay countdown={tts.countdown} onSkip={tts.skipPause} />
      )}

      {tts.error && (
        <div className={styles.errorBanner}>⚠ {tts.error}</div>
      )}

      <Controls
        status={tts.status}
        onPlay={handlePlay}
        onPause={tts.pause}
        onResume={tts.resume}
        onStop={tts.stop}
      />

      {tts.engine === 'elevenlabs' ? (
        <>
          <Sliders
            rate={tts.elRate}
            pitch={tts.elPitch}
            onRateChange={tts.setElRate}
            onPitchChange={tts.setElPitch}
          />
          <ElevenLabsPanel
            voices={tts.elVoices}
            selectedVoice={tts.elSelected}
            apiKey={tts.elApiKey}
            onVoiceSelect={tts.selectElVoice}
            onVoiceAdd={tts.addElVoice}
            onVoiceRemove={tts.removeElVoice}
            onApiKeyChange={tts.setElApiKey}
          />
        </>
      ) : tts.engine === 'google' ? (
        <GooglePanel
          apiKey={tts.gApiKey}
          voice={tts.gVoice}
          prompt={tts.gPrompt}
          pitch={tts.gPitch}
          rate={tts.gRate}
          onApiKeyChange={tts.setGApiKey}
          onVoiceChange={tts.setGVoice}
          onPromptChange={tts.setGPrompt}
          onPitchChange={tts.setGPitch}
          onRateChange={tts.setGRate}
        />
      ) : (
        <EdgePanel
          voices={tts.edVoices}
          selectedVoice={tts.edVoice}
          rate={tts.edRate}
          pitch={tts.edPitch}
          warn={tts.edWarn}
          onVoiceChange={tts.setEdVoice}
          onRateChange={tts.setEdRate}
          onPitchChange={tts.setEdPitch}
        />
      )}

      <DownloadButton
        status={dl.status}
        progress={dl.progress}
        error={dl.error}
        onDownload={() => dl.download(inputText)}
        onCancel={dl.cancel}
        disabled={!inputText.trim()}
      />
    </div>
  );
}
