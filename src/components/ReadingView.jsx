import { useEffect, useRef } from 'react';
import styles from './ReadingView.module.scss';

export default function ReadingView({ chunks, activeIndex }) {
  const activeRef = useRef(null);

  // Scroll active sentence into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  return (
    <div className={styles.view}>
      {chunks.map((chunk, i) => {
        if (chunk.type === 'pause') {
          return (
            <span key={i} className={styles.pauseMark}>
              ⏸ {chunk.minutes}min
            </span>
          );
        }

        const isActive = chunk.index === activeIndex;
        const isDone   = activeIndex > -1 && chunk.index < activeIndex;

        return (
          <span
            key={i}
            ref={isActive ? activeRef : null}
            className={[
              styles.sentence,
              isActive ? styles.active : '',
              isDone   ? styles.done   : '',
            ].join(' ')}
          >
            {chunk.text}{' '}
          </span>
        );
      })}
    </div>
  );
}
