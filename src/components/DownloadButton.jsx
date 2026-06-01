import styles from './DownloadButton.module.scss';

export default function DownloadButton({ status, progress, error, onDownload, onCancel, disabled }) {
  const isLoading = status === 'loading';
  const isDone    = status === 'done';
  const isError   = status === 'error';
  const pct       = progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0;

  return (
    <div className={styles.wrap}>
      {isLoading ? (
        <div className={styles.loadingRow}>
          <div className={styles.barWrap}>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${pct}%` }} />
            </div>
            <span className={styles.barLabel}>
              Generating MP3… {progress.done}/{progress.total}
            </span>
          </div>
          <button className={styles.cancelBtn} onClick={onCancel}>
            ✕ Cancel
          </button>
        </div>
      ) : (
        <button
          className={`${styles.btn} ${isDone ? styles.done : ''} ${isError ? styles.errState : ''}`}
          onClick={onDownload}
          disabled={disabled || isLoading}
        >
          {isDone  ? '✓ Downloaded!'  :
           isError ? '↓ Retry MP3'   :
                     '↓ Download MP3'}
        </button>
      )}

      {isError && (
        <p className={styles.errorMsg}>
          {error ?? 'Something went wrong. Check your connection and try again.'}
        </p>
      )}

      <p className={styles.note}>
        Note: [PAUSE] markers are skipped in the audio file.
      </p>
    </div>
  );
}
