import { useState } from 'react';
import { APP_CONFIG } from '../database.js';

export default function LoginGate({ onUnlock }) {
  const [accessKey, setAccessKey] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = accessKey.trim() && password.trim();
  const owner = APP_CONFIG.owner;
  const whatsapp = owner.whatsappUrl || `https://wa.me/${String(owner.whatsapp || '').replace(/\D/g, '')}`;
  const telegram = owner.telegramUrl || `https://t.me/${String(owner.telegram || '').replace('@', '')}`;

  function submit(event) {
    event.preventDefault();
    const gate = APP_CONFIG.accessGate;
    const valid = accessKey.trim() === gate.key && password === gate.password;
    if (!valid) {
      setError('Key atau password salah, Bos. Cek lagi, jangan asal gebrak keyboard.');
      return;
    }
    setError('');
    window.localStorage.setItem(gate.storageKey, 'true');
    onUnlock();
  }

  return (
    <main className="access-gate" aria-label="DRAK-GPT Access Gate">
      <div className="access-frame" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      <div className="access-bg-logo" aria-hidden="true" />
      <div className="access-glow" aria-hidden="true" />

      <form className="access-card" onSubmit={submit}>
        <img src="/icon.jpg" alt="DRAK-GPT" />
        <p className="access-kicker">DRAK-GPT by Dev ALIZZ</p>
        <h1>DRAK-GPT ACCESS</h1>
        <p className="access-subtitle">Masukkan key untuk masuk ke AI Core.</p>

        <label className="access-field">
          <span>Access Key</span>
          <input
            value={accessKey}
            onChange={(event) => setAccessKey(event.target.value)}
            autoComplete="off"
            inputMode="text"
            placeholder="Masukkan key"
          />
        </label>

        <label className="access-field">
          <span>Password</span>
          <div className="password-row">
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Masukkan password"
            />
            <button type="button" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        {error ? <p className="access-error" role="alert">{error}</p> : <p className="access-note">Demo access gate only, bukan keamanan server asli.</p>}

        <button className="access-submit" type="submit" disabled={!canSubmit}>Masuk</button>

        <div className="access-help-card">
          <span>Need help? Chat {owner.name}</span>
          <div>
            <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp Owner</a>
            <a href={telegram} target="_blank" rel="noreferrer">Telegram Owner</a>
          </div>
        </div>

        <footer>Created by Dev ALIZZ · {APP_CONFIG.owner.website}</footer>
      </form>
    </main>
  );
}
