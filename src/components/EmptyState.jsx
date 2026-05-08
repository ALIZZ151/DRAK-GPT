import { APP_CONFIG } from '../database.js';

export default function EmptyState({ onPrompt }) {
  return (
    <div className="empty-state">
      <img src="/icon.jpg" alt="Logo DRAK-GPT" />
      <h2>DRAK-GPT siap bantu, Bos.</h2>
      <p>Pilih prompt cepat atau langsung tanya apa aja.</p>
      <div className="quick-prompts">
        {APP_CONFIG.quickPrompts.map((prompt) => (
          <button key={prompt} type="button" onClick={() => onPrompt(prompt)}>
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
