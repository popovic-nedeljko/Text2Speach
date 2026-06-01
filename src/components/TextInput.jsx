import { forwardRef, useMemo } from 'react';
import styles from './TextInput.module.scss';

const PLACEHOLDER = `Paste your text here…

Use [PAUSE:N] markers to insert N-minute pauses.
Example: "Welcome to your session. [PAUSE:2] Take a deep breath. Feel your body relax. [PAUSE:3] We continue now."`;

const TextInput = forwardRef(function TextInput({ value, onChange }, ref) {
  const words = useMemo(() => {
    return value.trim() ? value.trim().split(/\s+/).length : 0;
  }, [value]);

  return (
    <div className={styles.wrap}>
      <textarea
        ref={ref}
        className={styles.textarea}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={PLACEHOLDER}
        spellCheck={false}
      />
      <div className={styles.counter}>
        <span>{words.toLocaleString()} words</span>
        <span className={styles.dot}>·</span>
        <span>{value.length.toLocaleString()} chars</span>
      </div>
    </div>
  );
});

export default TextInput;
