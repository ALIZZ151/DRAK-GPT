import { useMemo, useState } from 'react';
import { APP_CONFIG } from '../database.js';
import { dateLabel } from '../utils/sanitize.js';
import ThemeSettings from './ThemeSettings.jsx';

function shareText() {
  return [
    'DRAK-GPT by Dev ALIZZ',
    'AI assistant gaul buat bantu chat, coding, ide, dan kebutuhan digital.',
    '',
    `Link: ${APP_CONFIG.share.website}`,
    '',
    `Login: ${APP_CONFIG.share.loginNote || 'Minta username dan password ke owner.'}`
  ].join('\n');
}

export default function ChatSidebar({
  open,
  chats,
  activeChatId,
  onClose,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  onClearAll,
  themeId,
  onThemeChange,
  storageMode,
  onLogout
}) {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState('');
  const filteredChats = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return chats;
    return chats.filter((chat) => chat.title?.toLowerCase().includes(needle));
  }, [chats, query]);

  const owner = APP_CONFIG.owner;
  const whatsapp = owner.whatsappUrl || `https://wa.me/${String(owner.whatsapp || '').replace(/\D/g, '')}`;
  const telegram = owner.telegramUrl || `https://t.me/${String(owner.telegram || '').replace('@', '')}`;
  const waShare = `https://wa.me/?text=${encodeURIComponent(shareText())}`;

  async function copyValue(type, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
      window.setTimeout(() => setCopied(''), 1300);
    } catch {
      setCopied('');
    }
  }

  return (
    <>
      <aside className={`chat-sidebar ${open ? 'open' : ''}`} aria-label="Riwayat dan pengaturan">
        <div className="sidebar-head">
          <div>
            <strong>DRAK-GPT</strong>
            <span>{storageMode}</span>
          </div>
          <button className="icon-button close-sidebar" type="button" onClick={onClose} aria-label="Tutup menu">
            ×
          </button>
        </div>

        <button className="new-chat-button" type="button" onClick={onNewChat}>
          ＋ Chat Baru
        </button>

        <label className="history-search">
          <span className="sr-only">Cari riwayat chat</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari riwayat..." />
        </label>

        <div className="history-list" role="list">
          {filteredChats.length ? (
            filteredChats.map((chat) => (
              <article className={`history-item ${chat.id === activeChatId ? 'active' : ''}`} key={chat.id} role="listitem">
                <button type="button" onClick={() => onSelectChat(chat.id)}>
                  <strong>{chat.title || 'Chat Baru'}</strong>
                  <span>{dateLabel(chat.updatedAt || chat.createdAt)} · {chat.model || 'instant'}</span>
                </button>
                <div className="history-actions">
                  <button type="button" onClick={() => onRenameChat(chat.id)} title="Rename chat">✎</button>
                  <button type="button" onClick={() => onDeleteChat(chat.id)} title="Hapus chat">⌫</button>
                </div>
              </article>
            ))
          ) : (
            <p className="empty-history">Belum ada riwayat yang cocok.</p>
          )}
        </div>

        <ThemeSettings themeId={themeId} onThemeChange={onThemeChange} />

        <div className="owner-card about-card">
          <p className="sidebar-label">About DRAK-GPT</p>
          <strong>DRAK-GPT by {owner.name}</strong>
          <span>AI assistant gaul buat bantu chat, coding, ide, file kecil, gambar, dan kebutuhan digital.</span>
        </div>

        <div className="owner-card share-card">
          <p className="sidebar-label">Share DRAK-GPT</p>
          <strong>{APP_CONFIG.share.website}</strong>
          <span>{APP_CONFIG.share.loginNote || 'Minta key dan password ke owner.'}</span>
          <div className="owner-links share-actions">
            <button type="button" onClick={() => copyValue('link', APP_CONFIG.share.website)}>{copied === 'link' ? 'Copied' : 'Copy Link'}</button>
            <button type="button" onClick={() => copyValue('info', shareText())}>{copied === 'info' ? 'Copied' : 'Copy Info'}</button>
            <a href={waShare} target="_blank" rel="noreferrer">Share WhatsApp</a>
          </div>
        </div>

        <div className="owner-card">
          <p className="sidebar-label">Kontak Owner</p>
          <strong>{owner.name}</strong>
          <span>Kalau error terus, chat owner. Jangan dipendem kayak bug production.</span>
          <div className="owner-links">
            <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp Owner</a>
            <a href={telegram} target="_blank" rel="noreferrer">Telegram Owner</a>
          </div>
        </div>

        <div className="sidebar-actions-stack">
          <button className="logout-button" type="button" onClick={onLogout}>
            Logout Akun
          </button>
          <button className="danger-button" type="button" onClick={onClearAll}>
            Hapus Semua Local Chat
          </button>
        </div>

        <footer className="sidebar-footer">DRAK-GPT by Dev ALIZZ · v{APP_CONFIG.app.version}</footer>
      </aside>
      <button className={`sidebar-backdrop ${open ? 'show' : ''}`} type="button" onClick={onClose} aria-label="Tutup sidebar" />
    </>
  );
}
