import { APP_CONFIG } from '../database.js';

export default function ThemeSettings({ themeId, onThemeChange }) {
  return (
    <div className="theme-settings">
      <p className="sidebar-label">Tema</p>
      <div className="theme-grid">
        {Object.values(APP_CONFIG.themes).map((theme) => (
          <button
            className={`theme-chip ${themeId === theme.id ? 'active' : ''}`}
            key={theme.id}
            onClick={() => onThemeChange(theme.id)}
            type="button"
            style={{ '--chip-accent': theme.accent }}
          >
            <span />
            {theme.label}
          </button>
        ))}
      </div>
    </div>
  );
}
