import { useRef, useState } from 'react';
import { useTTS } from './hooks/useTTS';
import { useDownload } from './hooks/useDownload';
import TextInput from './components/TextInput';
import ReadingView from './components/ReadingView';
import Controls from './components/Controls';
import ProgressBar from './components/ProgressBar';
import PauseOverlay from './components/PauseOverlay';
import Sliders from './components/Sliders';
import VoiceInfo from './components/VoiceInfo';
import WarnBanner from './components/WarnBanner';
import DownloadButton from './components/DownloadButton';
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

  function handleStop() {
    tts.stop();
  }

  return (
    <div className={`${styles.app} ${tts.countdown ? styles.amberMode : ''}`}>
      <h1 className={styles.title}>
        Text to <span>Speech</span>
      </h1>

      <WarnBanner />

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

      <Controls
        status={tts.status}
        onPlay={handlePlay}
        onPause={tts.pause}
        onResume={tts.resume}
        onStop={handleStop}
      />

      <Sliders
        rate={tts.rate}
        pitch={tts.pitch}
        onRateChange={tts.setRate}
        onPitchChange={tts.setPitch}
      />

      <VoiceInfo
        voice={tts.voice}
        allVoices={tts.allVoices}
        onVoiceChange={tts.selectVoice}
      />

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
