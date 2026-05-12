import { useEffect, useState } from 'react';
import { APP_CONFIG } from '../database.js';

function dateText(value) {
  if (!value) return 'Tidak diset';
  try { return new Date(value).toLocaleString('id-ID'); } catch { return String(value); }
}

export default function DashboardPage({ onLogout }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    fetch('/api/user/dashboard', { credentials: 'include' })
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!mounted) return;
        if (!ok || !body.success) throw new Error(body.message || 'Dashboard gagal dimuat.');
        setData(body);
      })
      .catch((err) => mounted && setError(err.message));
    return () => { mounted = false; };
  }, []);

  const owner = data?.owner || APP_CONFIG.owner;
  const user = data?.user;
  const plan = data?.plan;
  const limit = data?.limit;
  const status = user?.accountStatus || user?.status;

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card premium-card">
        <img src="/icon.jpg" alt="DRAK-GPT" />
        <p className="access-kicker">USER DASHBOARD</p>
        <h1>DRAK-GPT Premium</h1>
        {error && <p className="access-error">{error}</p>}
        {!data && !error && <p className="access-note">Memuat dashboard...</p>}
        {data && (
          <>
            {status === 'expired' && <div className="state-banner danger">Masa aktif akun habis. Hubungi admin untuk perpanjang.</div>}
            {status === 'suspended' && <div className="state-banner danger">Akun disuspend. Hubungi admin.</div>}
            <div className="info-grid">
              <div><span>Username</span><strong>{user.username}</strong></div>
              <div><span>Status</span><strong>{status}</strong></div>
              <div><span>Paket</span><strong>{plan?.name || 'Default'}</strong></div>
              <div><span>Expired</span><strong>{dateText(user.expiredAt)}</strong></div>
              <div><span>Limit Harian</span><strong>{limit?.dailyUsed || 0}/{limit?.dailyLimit || 0}</strong></div>
              <div><span>Sisa Limit</span><strong>{limit?.remaining || 0}</strong></div>
              <div><span>Device</span><strong>{user.deviceName || (user.deviceId ? 'Terdaftar' : 'Belum terdaftar')}</strong></div>
              <div><span>Last Login</span><strong>{dateText(user.lastLoginAt)}</strong></div>
            </div>
            <div className="dashboard-actions">
              <a className="access-submit link-button" href="/">Buka Chat</a>
              <button className="logout-button" type="button" onClick={onLogout}>Logout</button>
            </div>
          </>
        )}
        <div className="access-help-card">
          <span>Kontak owner/admin</span>
          <div>
            <a href={owner.whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a>
            <a href={owner.telegramUrl} target="_blank" rel="noreferrer">Telegram</a>
          </div>
        </div>
      </section>
    </main>
  );
}
