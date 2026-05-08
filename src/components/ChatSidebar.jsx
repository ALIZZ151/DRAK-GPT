import { useMemo, useState } from 'react';
import { APP_CONFIG } from '../database.js';
import { dateLabel } from '../utils/sanitize.js';
import ThemeSettings from './ThemeSettings.jsx';

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
  storageMode
}) {
  const [query, setQuery] = useState('');
  const filteredChats = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return chats;
    return chats.filter((chat) => chat.title?.toLowerCase().includes(needle));
  }, [chats, query]);

  const owner = APP_CONFIG.owner;
  const whatsapp = owner.whatsapp && !owner.whatsapp.includes('ISI_') ? `https://wa.me/${owner.whatsapp.replace(/\D/g, '')}` : null;
  const telegram = owner.telegram && !owner.telegram.includes('ISI_') ? `https://t.me/${owner.telegram.replace('@', '')}` : null;

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

        <div className="owner-card">
          <p className="sidebar-label">Owner</p>
          <strong>{owner.name}</strong>
          <span>Kalau error terus, hubungi owner.</span>
          <div className="owner-links">
            {whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a> : <span>WhatsApp: isi di database.js</span>}
            {telegram ? <a href={telegram} target="_blank" rel="noreferrer">Telegram</a> : <span>Telegram: isi di database.js</span>}
          </div>
        </div>

        <button className="danger-button" type="button" onClick={onClearAll}>
          Hapus Semua Local Chat
        </button>

        <footer className="sidebar-footer">DRAK-GPT by Dev ALIZZ · v{APP_CONFIG.app.version}</footer>
      </aside>
      <button className={`sidebar-backdrop ${open ? 'show' : ''}`} type="button" onClick={onClose} aria-label="Tutup sidebar" />
    </>
  );
}
