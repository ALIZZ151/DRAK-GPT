import { useState } from 'react';
import { APP_CONFIG } from '../database.js';
import { getDeviceId } from '../utils/storage.js';

export default function LoginGate({ onUnlock }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = username.trim() && password.trim() && !submitting;
  const owner = APP_CONFIG.owner;
  const whatsapp = owner.whatsappUrl || `https://wa.me/${String(owner.whatsapp || '').replace(/\D/g, '')}`;
  const telegram = owner.telegramUrl || `https://t.me/${String(owner.telegram || '').replace('@', '')}`;

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: username.trim(),
          password,
          deviceId: getDeviceId(),
          deviceName: navigator.userAgent.slice(0, 120)
        })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || 'Login gagal.');
      onUnlock(data.user);
    } catch (err) {
      setError(err?.message || 'Login gagal. Coba ulangi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="access-gate" aria-label="DRAK-GPT Login">
      <div className="access-frame" aria-hidden="true"><span /><span /><span /><span /></div>
      <div className="access-bg-logo" aria-hidden="true" />
      <div className="access-glow" aria-hidden="true" />

      <form className="access-card" onSubmit={submit}>
        <img src="/icon.jpg" alt="DRAK-GPT" />
        <p className="access-kicker">DRAK-GPT by Dev ALIZZ</p>
        <h1>DRAK-GPT LOGIN</h1>
        <p className="access-subtitle">Masuk memakai akun premium yang dibuat admin.</p>

        <label className="access-field">
          <span>Username</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            inputMode="text"
            placeholder="contoh: bosalizz"
            disabled={submitting}
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
              disabled={submitting}
            />
            <button type="button" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        {error ? <p className="access-error" role="alert">{error}</p> : <p className="access-note">Session disimpan sebagai HttpOnly Secure Cookie. Token utama tidak ditaruh di localStorage.</p>}

        <button className="access-submit" type="submit" disabled={!canSubmit}>{submitting ? 'Mengecek...' : 'Masuk'}</button>

        <div className="access-help-card">
          <span>Butuh akun/reset device? Chat {owner.name}</span>
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
