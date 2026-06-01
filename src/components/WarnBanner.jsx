import styles from './WarnBanner.module.scss';

export default function WarnBanner() {
  if ('speechSynthesis' in window) return null;

  return (
    <div className={styles.banner}>
      Your browser does not support the Web Speech API.
      Please use Chrome, Edge, or Safari.
    </div>
  );
}
