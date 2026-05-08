import { APP_CONFIG, getModelById } from '../database.js';

export default function ModelSelector({ value, onChange, compact = false }) {
  const selected = getModelById(value);

  return (
    <label className={`model-selector ${compact ? 'is-compact' : ''}`}>
      <span className="sr-only">Pilih model AI</span>
      <span className="model-badge">{selected.badge}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} title={selected.description}>
        {APP_CONFIG.models.map((model) => (
          <option value={model.id} key={model.id}>
            {model.label}
          </option>
        ))}
      </select>
    </label>
  );
}
