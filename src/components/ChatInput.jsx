import { useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from '../database.js';
import { fileToAttachment } from '../utils/fileReader.js';
import FilePreview from './FilePreview.jsx';

export default function ChatInput({ disabled, processing = false, attachments, setAttachments, onSend, onNotice }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [value]);

  async function handleFiles(files) {
    const selected = Array.from(files || []);
    if (!selected.length) return;

    const current = attachments.length;
    const allowed = APP_CONFIG.limits.maxAttachments - current;
    if (allowed <= 0) {
      onNotice(`Maksimal ${APP_CONFIG.limits.maxAttachments} lampiran dulu, Bos.`);
      return;
    }

    for (const file of selected.slice(0, allowed)) {
      try {
        const attachment = await fileToAttachment(file);
        setAttachments((prev) => [...prev, attachment]);
      } catch (error) {
        onNotice(error.message);
      }
    }
  }

  function submit() {
    const text = value;
    if (!text.trim() && !attachments.length) return;
    setValue('');
    onSend(text);
  }

  return (
    <section className="input-shell" aria-label="Input chat">
      <FilePreview attachments={attachments} onRemove={(id) => setAttachments((prev) => prev.filter((item) => item.id !== id))} />
      <div className="composer">
        <div className="attach-row">
          <button type="button" onClick={() => fileInputRef.current?.click()} title="Upload file kecil">＋File</button>
          <button type="button" onClick={() => imageInputRef.current?.click()} title="Upload gambar">Gambar</button>
          <button type="button" onClick={() => cameraInputRef.current?.click()} title="Kamera mobile">Kamera</button>
          <button type="button" onClick={() => onSend('/image')} title="Buat gambar">/image</button>
        </div>

        <div className="composer-main">
          <textarea
            ref={textareaRef}
            value={value}
            disabled={disabled}
            rows={1}
            maxLength={APP_CONFIG.limits.maxMessageLength}
            placeholder={disabled ? 'Offline dulu, riwayat tetap aman...' : processing ? 'DRAK-GPT lagi mikir, Bos...' : 'Tanya apa aja ke DRAK-GPT...'}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />
          <button className={`send-button ${processing ? 'is-loading' : ''}`} type="button" onClick={submit} disabled={disabled || processing || (!value.trim() && !attachments.length)}>
            {processing ? 'Proses...' : 'Kirim'}
          </button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" hidden multiple accept=".txt,.json,.md,.pdf,text/plain,application/json,text/markdown,application/pdf" onChange={(event) => handleFiles(event.target.files)} />
      <input ref={imageInputRef} type="file" hidden multiple accept="image/png,image/jpeg,image/webp" onChange={(event) => handleFiles(event.target.files)} />
      <input ref={cameraInputRef} type="file" hidden accept="image/*" capture="environment" onChange={(event) => handleFiles(event.target.files)} />
    </section>
  );
}
