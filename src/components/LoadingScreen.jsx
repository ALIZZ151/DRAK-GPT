import { useEffect, useState } from 'react';

export default function LoadingScreen({ onDone }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 450 : 1850;
    const startedAt = performance.now();
    let frame = 0;

    const tick = (time) => {
      const ratio = Math.min((time - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - ratio, 3);
      setProgress(Math.round(eased * 100));
      if (ratio < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        window.setTimeout(onDone, reduced ? 50 : 250);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [onDone]);

  return (
    <section className="loading-screen" aria-label="Loading DRAK-GPT">
      <div className="loading-orb" />
      <div className="loading-card">
        <img className="loading-logo" src="/icon.jpg" alt="DRAK-GPT" />
        <h1>DRAK-GPT</h1>
        <p>Initializing AI Core...</p>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <small>{progress}%</small>
      </div>
    </section>
  );
}
