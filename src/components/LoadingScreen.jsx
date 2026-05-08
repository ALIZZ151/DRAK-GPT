import { useEffect, useState } from 'react';

export default function LoadingScreen({ onDone }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 650 : 2050;
    const startedAt = performance.now();
    let frame = 0;

    const tick = (time) => {
      const ratio = Math.min((time - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - ratio, 3);
      setProgress(Math.round(eased * 100));
      if (ratio < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        window.setTimeout(onDone, reduced ? 80 : 220);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [onDone]);

  return (
    <section className="loading-screen" aria-label="Loading DRAK-GPT">
      <div className="loading-frame" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      <div className="loading-grid" aria-hidden="true" />
      <div className="loading-scan" aria-hidden="true" />
      <div className="loading-particles" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, index) => <i key={index} style={{ '--i': index }} />)}
      </div>
      <div className="loading-orb" aria-hidden="true" />

      <div className="loading-card">
        <div className="loading-logo-wrap">
          <img className="loading-logo" src="/icon.jpg" alt="DRAK-GPT" />
        </div>
        <p className="loading-kicker">AI CORE ONLINE</p>
        <h1>DRAK-GPT</h1>
        <p className="loading-subtitle">Initializing AI Core...</p>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="loading-progress-meta">
          <small>BOOT SEQUENCE</small>
          <small>{progress}%</small>
        </div>
      </div>
    </section>
  );
}
