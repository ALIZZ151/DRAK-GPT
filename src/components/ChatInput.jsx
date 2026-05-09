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
  const inputShellRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 120 ? 'auto' : 'hidden';
  }, [value]);

  useEffect(() => {
    const shell = inputShellRef.current;
    if (!shell) return;

    let frame = 0;
    const root = document.documentElement;

    const updateComposerMetrics = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = Math.ceil(shell.getBoundingClientRect().height);
        root.style.setProperty('--composer-height', `${height}px`);

        // Keep the composer visible when mobile keyboards shrink the visual viewport.
        // This is viewport-based only; it does not depend on chat content height.
        const viewport = window.visualViewport;
        const keyboardOffset = viewport
          ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
          : 0;
        root.style.setProperty('--composer-keyboard-offset', `${Math.ceil(keyboardOffset)}px`);
      });
    };

    updateComposerMetrics();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateComposerMetrics) : null;
    observer?.observe(shell);

    window.addEventListener('resize', updateComposerMetrics);
    window.visualViewport?.addEventListener('resize', updateComposerMetrics);
    window.visualViewport?.addEventListener('scroll', updateComposerMetrics);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', updateComposerMetrics);
      window.visualViewport?.removeEventListener('resize', updateComposerMetrics);
      window.visualViewport?.removeEventListener('scroll', updateComposerMetrics);
      root.style.setProperty('--composer-keyboard-offset', '0px');
    };
  }, [attachments.length]);

  async function handleFiles(files, source = 'file') {
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
        const attachment = await fileToAttachment(file, { source });
        setAttachments((prev) => [...prev, attachment]);
        if (attachment.compressed) onNotice(`Gambar dikompres jadi ${attachment.sizeLabel}. Aman dikirim, Bos.`);
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
    [fileInputRef, imageInputRef, cameraInputRef].forEach((input) => {
      if (input.current) input.current.value = '';
    });
  }

  return (
    <section ref={inputShellRef} className="input-shell" aria-label="Input chat">
      <FilePreview attachments={attachments} onRemove={(id) => setAttachments((prev) => prev.filter((item) => item.id !== id))} />
      <div className="composer">
        <div className="attach-row">
          <button type="button" onClick={() => fileInputRef.current?.click()} title="Upload file kecil">＋File</button>
          <button type="button" onClick={() => imageInputRef.current?.click()} title="Upload gambar">Gambar</button>
          <button type="button" onClick={() => cameraInputRef.current?.click()} title="Kamera mobile">Kamera</button>
          <button type="button" onClick={() => { setValue((current) => current.trim() ? current : '/image '); textareaRef.current?.focus(); }} title="Buat gambar">/image</button>
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

      <input ref={fileInputRef} type="file" hidden multiple accept=".txt,.json,.md,.pdf,text/plain,application/json,text/markdown,application/pdf" onChange={(event) => handleFiles(event.target.files, 'file')} />
      <input ref={imageInputRef} type="file" hidden multiple accept="image/png,image/jpeg,image/webp" onChange={(event) => handleFiles(event.target.files, 'image')} />
      <input ref={cameraInputRef} type="file" hidden accept="image/*" capture="environment" onChange={(event) => handleFiles(event.target.files, 'camera')} />
    </section>
  );
}
