import { useEffect, useState } from 'react';

const WELCOME_TEXT = 'SELAMAT DATANG DI DRAK-GPT';

export default function EmptyState() {
  const [shown, setShown] = useState('');

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setShown(WELCOME_TEXT);
      return undefined;
    }

    setShown('');
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setShown(WELCOME_TEXT.slice(0, index));
      if (index >= WELCOME_TEXT.length) window.clearInterval(timer);
    }, 46);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="empty-state" aria-label="Selamat datang DRAK-GPT">
      <img src="/icon.jpg" alt="Logo DRAK-GPT" />
      <h2 className="typing-welcome">
        {shown}
        <span aria-hidden="true" />
      </h2>
    </div>
  );
}
