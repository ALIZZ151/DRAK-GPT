import { useEffect, useMemo, useState } from 'react';

const TABS = ['dashboard', 'users', 'plans', 'api-keys', 'logs', 'settings'];

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success === false) throw new Error(data?.message || `Request gagal: ${response.status}`);
  return data;
}

function formatDate(value) {
  if (!value) return '-';
  try { return new Date(value).toLocaleString('id-ID'); } catch { return String(value); }
}

function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      onLogin(data.admin);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-login access-gate">
      <form className="access-card" onSubmit={submit}>
        <img src="/icon.jpg" alt="DRAK-GPT" />
        <p className="access-kicker">PRIVATE ROUTE</p>
        <h1>Admin Login</h1>
        <p className="access-subtitle">Panel admin tidak ditautkan di UI publik.</p>
        <label className="access-field"><span>Username Admin</span><input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /></label>
        <label className="access-field"><span>Password</span><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" /></label>
        {error ? <p className="access-error">{error}</p> : <p className="access-note">Session admin memakai cookie terpisah dan role check server-side.</p>}
        <button className="access-submit" disabled={loading || !username || !password}>{loading ? 'Masuk...' : 'Masuk Admin'}</button>
      </form>
    </main>
  );
}

function DashboardTab({ stats, reload }) {
  const cards = [
    ['Total user', stats?.totalUser || 0],
    ['User aktif', stats?.userAktif || 0],
    ['User expired', stats?.userExpired || 0],
    ['User suspended', stats?.userSuspended || 0],
    ['Request hari ini', stats?.requestHariIni || 0],
    ['API key aktif', stats?.apiKeyAktif || 0]
  ];
  return (
    <section className="admin-section">
      <div className="admin-section-head"><h2>Dashboard</h2><button onClick={reload}>Refresh</button></div>
      <div className="stat-grid">{cards.map(([label, value]) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <div className="admin-panel-card"><span>Error API terakhir</span><strong>{stats?.errorApiTerakhir || 'Tidak ada error tercatat'}</strong></div>
    </section>
  );
}

function UsersTab({ users, plans, reload }) {
  const [form, setForm] = useState({ username: '', password: '', planId: '', activeDays: 30 });
  const [error, setError] = useState('');

  async function createUser(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/admin/users', { method: 'POST', body: JSON.stringify(form) });
      setForm({ username: '', password: '', planId: '', activeDays: 30 });
      reload();
    } catch (err) { setError(err.message); }
  }

  async function action(user, path, body = {}) {
    try {
      await api(`/api/admin/users/${user.id}/${path}`, { method: 'POST', body: JSON.stringify(body) });
      reload();
    } catch (err) { alert(err.message); }
  }

  async function patchUser(user, patch) {
    try {
      await api(`/api/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      reload();
    } catch (err) { alert(err.message); }
  }

  async function deleteUser(user) {
    if (!confirm(`Hapus user ${user.username}?`)) return;
    try {
      await api(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      reload();
    } catch (err) { alert(err.message); }
  }

  return (
    <section className="admin-section">
      <div className="admin-section-head"><h2>Users</h2><button onClick={reload}>Refresh</button></div>
      <form className="admin-form" onSubmit={createUser}>
        <input placeholder="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input placeholder="password min 8" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
          <option value="">Default plan</option>
          {plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.name}</option>)}
        </select>
        <input type="number" min="1" placeholder="hari aktif" value={form.activeDays} onChange={(e) => setForm({ ...form, activeDays: e.target.value })} />
        <button>Buat User</button>
      </form>
      {error && <p className="access-error">{error}</p>}
      <div className="table-wrap"><table><thead><tr><th>User</th><th>Status</th><th>Plan</th><th>Expired</th><th>Limit</th><th>Device</th><th>Aksi</th></tr></thead><tbody>
        {users.map((user) => <tr key={user.id}>
          <td><strong>{user.username}</strong><br /><small>{user.role}</small></td>
          <td>{user.status}</td>
          <td>{user.plan_name || '-'}</td>
          <td>{formatDate(user.expired_at)}</td>
          <td>{user.daily_used}/{user.plan_daily_limit || '-'}</td>
          <td>{user.device_id ? 'Locked' : 'Empty'}<br /><small>{user.device_name || ''}</small></td>
          <td className="action-cell">
            <button onClick={() => action(user, 'reset-device')}>Reset Device</button>
            {user.status === 'suspended' ? <button onClick={() => action(user, 'unsuspend')}>Unsuspend</button> : <button onClick={() => action(user, 'suspend')}>Suspend</button>}
            <button onClick={() => action(user, 'extend', { days: Number(prompt('Tambah berapa hari?', '30') || 30) })}>Extend</button>
            <button onClick={() => patchUser(user, { password: prompt('Password baru min 8 karakter') || '' })}>Ubah Password</button>
            <button className="danger-button" onClick={() => deleteUser(user)}>Hapus</button>
          </td>
        </tr>)}
      </tbody></table></div>
    </section>
  );
}

function PlansTab({ plans, reload }) {
  const [form, setForm] = useState({ name: 'Premium', price: 0, dailyLimit: 100, activeDays: 30, maxDevices: 1 });
  async function submit(event) {
    event.preventDefault();
    try { await api('/api/admin/plans', { method: 'POST', body: JSON.stringify(form) }); reload(); } catch (err) { alert(err.message); }
  }
  async function remove(plan) {
    if (!confirm(`Hapus paket ${plan.name}?`)) return;
    try { await api(`/api/admin/plans/${plan.id}`, { method: 'DELETE' }); reload(); } catch (err) { alert(err.message); }
  }
  return (
    <section className="admin-section">
      <div className="admin-section-head"><h2>Plans</h2><button onClick={reload}>Refresh</button></div>
      <form className="admin-form" onSubmit={submit}>
        <input placeholder="nama paket" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input type="number" placeholder="harga" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
        <input type="number" placeholder="limit harian" value={form.dailyLimit} onChange={(e) => setForm({ ...form, dailyLimit: Number(e.target.value) })} />
        <input type="number" placeholder="hari aktif" value={form.activeDays} onChange={(e) => setForm({ ...form, activeDays: Number(e.target.value) })} />
        <button>Buat Paket</button>
      </form>
      <div className="table-wrap"><table><thead><tr><th>Nama</th><th>Harga</th><th>Limit</th><th>Durasi</th><th>Aksi</th></tr></thead><tbody>
        {plans.map((plan) => <tr key={plan.id}><td>{plan.name}</td><td>{plan.price}</td><td>{plan.dailyLimit}</td><td>{plan.activeDays} hari</td><td><button className="danger-button" onClick={() => remove(plan)}>Hapus</button></td></tr>)}
      </tbody></table></div>
    </section>
  );
}

function ApiKeysTab({ apiKeys, reload }) {
  const [form, setForm] = useState({ label: '', provider: 'openai-compatible', apiUrl: '', apiKey: '', priority: 100 });
  async function submit(event) {
    event.preventDefault();
    try { await api('/api/admin/api-keys', { method: 'POST', body: JSON.stringify(form) }); setForm({ label: '', provider: 'openai-compatible', apiUrl: '', apiKey: '', priority: 100 }); reload(); } catch (err) { alert(err.message); }
  }
  async function patch(key, data) {
    try { await api(`/api/admin/api-keys/${key.id}`, { method: 'PATCH', body: JSON.stringify(data) }); reload(); } catch (err) { alert(err.message); }
  }
  async function remove(key) {
    if (!confirm(`Hapus API key ${key.label}?`)) return;
    try { await api(`/api/admin/api-keys/${key.id}`, { method: 'DELETE' }); reload(); } catch (err) { alert(err.message); }
  }
  return (
    <section className="admin-section">
      <div className="admin-section-head"><h2>API Key Manager</h2><button onClick={reload}>Refresh</button></div>
      <form className="admin-form wide" onSubmit={submit}>
        <input placeholder="label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        <input placeholder="api url" value={form.apiUrl} onChange={(e) => setForm({ ...form, apiUrl: e.target.value })} />
        <input placeholder="api key rahasia" type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
        <input type="number" placeholder="priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
        <button>Simpan Key</button>
      </form>
      <div className="table-wrap"><table><thead><tr><th>Label</th><th>Masked</th><th>Status</th><th>Priority</th><th>Usage</th><th>Error</th><th>Aksi</th></tr></thead><tbody>
        {apiKeys.map((key) => <tr key={key.id}><td>{key.label}<br /><small>{key.apiUrl}</small></td><td>{key.maskedKey}</td><td>{key.status}</td><td>{key.priority}</td><td>{key.totalUsed}</td><td>{key.lastError || '-'}</td><td className="action-cell"><button onClick={() => patch(key, { status: key.status === 'active' ? 'inactive' : 'active' })}>{key.status === 'active' ? 'Nonaktif' : 'Aktifkan'}</button><button onClick={() => patch(key, { priority: Number(prompt('Priority baru', key.priority) || key.priority) })}>Priority</button><button className="danger-button" onClick={() => remove(key)}>Hapus</button></td></tr>)}
      </tbody></table></div>
    </section>
  );
}

function LogsTab({ logs, logType, setLogType, reload }) {
  return (
    <section className="admin-section">
      <div className="admin-section-head"><h2>Logs</h2><div><select value={logType} onChange={(e) => setLogType(e.target.value)}><option value="login">Login</option><option value="chat">Chat</option><option value="usage">Usage</option><option value="error">API Error</option><option value="audit">Audit</option></select><button onClick={reload}>Refresh</button></div></div>
      <div className="log-list">{logs.map((log, index) => <pre key={log.id || index}>{JSON.stringify(log, null, 2)}</pre>)}</div>
    </section>
  );
}

function SettingsTab({ settings, reload }) {
  const [maintenance, setMaintenance] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  async function save() {
    try { await api('/api/admin/settings', { method: 'PATCH', body: JSON.stringify({ maintenance_mode: maintenance, global_announcement: announcement }) }); reload(); } catch (err) { alert(err.message); }
  }
  return (
    <section className="admin-section">
      <div className="admin-section-head"><h2>Settings</h2><button onClick={reload}>Refresh</button></div>
      <div className="admin-form settings-form">
        <label><input type="checkbox" checked={maintenance} onChange={(e) => setMaintenance(e.target.checked)} /> Maintenance mode</label>
        <textarea placeholder="Global announcement" value={announcement} onChange={(e) => setAnnouncement(e.target.value)} />
        <button type="button" onClick={save}>Simpan Settings</button>
      </div>
      <pre className="admin-panel-card">{JSON.stringify(settings, null, 2)}</pre>
    </section>
  );
}

export default function AdminApp() {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logType, setLogType] = useState('login');
  const [settings, setSettings] = useState({});

  async function checkAdmin() {
    try { const data = await api('/api/admin/me'); setAdmin(data.admin); } catch { setAdmin(null); } finally { setLoading(false); }
  }

  async function reload() {
    if (!admin) return;
    const tasks = [
      api('/api/admin/stats').then((data) => setStats(data.stats)).catch(() => null),
      api('/api/admin/users').then((data) => setUsers(data.users || [])).catch(() => null),
      api('/api/admin/plans').then((data) => setPlans(data.plans || [])).catch(() => null),
      api('/api/admin/api-keys').then((data) => setApiKeys(data.apiKeys || [])).catch(() => null),
      api(`/api/admin/logs?type=${encodeURIComponent(logType)}`).then((data) => setLogs(data.logs || [])).catch(() => null),
      api('/api/admin/settings').then((data) => setSettings(data.settings || {})).catch(() => null)
    ];
    await Promise.all(tasks);
  }

  useEffect(() => { checkAdmin(); }, []);
  useEffect(() => { reload(); }, [admin, logType]);

  async function logout() {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => null);
    setAdmin(null);
  }

  const content = useMemo(() => {
    if (tab === 'users') return <UsersTab users={users} plans={plans} reload={reload} />;
    if (tab === 'plans') return <PlansTab plans={plans} reload={reload} />;
    if (tab === 'api-keys') return <ApiKeysTab apiKeys={apiKeys} reload={reload} />;
    if (tab === 'logs') return <LogsTab logs={logs} logType={logType} setLogType={setLogType} reload={reload} />;
    if (tab === 'settings') return <SettingsTab settings={settings} reload={reload} />;
    return <DashboardTab stats={stats} reload={reload} />;
  }, [tab, users, plans, apiKeys, logs, logType, settings, stats]);

  if (loading) return <main className="dashboard-shell"><p>Loading admin...</p></main>;
  if (!admin) return <AdminLogin onLogin={setAdmin} />;

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand-lockup"><img src="/icon.jpg" alt="DRAK-GPT" /><div><strong>DRAK-GPT</strong><span>Admin Panel</span></div></div>
        <nav>{TABS.map((item) => <button className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}>{item}</button>)}</nav>
        <div className="admin-profile"><strong>{admin.username}</strong><span>{admin.role}</span><button onClick={logout}>Logout Admin</button></div>
      </aside>
      <section className="admin-main">{content}</section>
    </main>
  );
}
