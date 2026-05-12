import ModelSelector from './ModelSelector.jsx';

export default function ChatHeader({ model, onModelChange, onMenu, online, storageMode }) {
  return (
    <header className="chat-header">
      <div className="brand-lockup">
        <img src="/icon.jpg" alt="DRAK-GPT" />
        <div>
          <strong>DRAK-GPT</strong>
          <span>by Dev ALIZZ</span>
        </div>
      </div>

      <div className="header-actions">
        <span className={`status-pill ${online ? 'online' : 'offline'}`} title={online ? 'Online' : 'Offline'}>
          {online ? storageMode : 'Offline'}
        </span>
        <a className="header-dashboard-link" href="/dashboard">Dashboard</a>
        <ModelSelector value={model} onChange={onModelChange} compact />
        <button className="icon-button menu-button" type="button" onClick={onMenu} aria-label="Buka menu">
          ☰
        </button>
      </div>
    </header>
  );
}
