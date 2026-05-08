import { useState } from 'react';
import { dateLabel } from '../utils/sanitize.js';

function InlineText({ text }) {
  const parts = String(text).split(/(`[^`]+`|https?:\/\/[^\s]+)/g);
  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={index} href={part} target="_blank" rel="noreferrer noopener">
          {part}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function MarkdownLite({ content }) {
  const blocks = String(content || '').split(/```([\s\S]*?)```/g);

  return (
    <div className="markdown-lite">
      {blocks.map((block, index) => {
        if (index % 2 === 1) {
          return (
            <pre key={index}>
              <code>{block.replace(/^\w+\n/, '')}</code>
            </pre>
          );
        }

        return block
          .split('\n')
          .map((line, lineIndex) => {
            const key = `${index}-${lineIndex}`;
            if (!line.trim()) return <br key={key} />;
            if (/^#{1,3}\s+/.test(line)) {
              return <h4 key={key}><InlineText text={line.replace(/^#{1,3}\s+/, '')} /></h4>;
            }
            if (/^[-*]\s+/.test(line)) {
              return <p className="list-line" key={key}>• <InlineText text={line.replace(/^[-*]\s+/, '')} /></p>;
            }
            return <p key={key}><InlineText text={line} /></p>;
          });
      })}
    </div>
  );
}

export default function MessageBubble({ message, onRetry }) {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === 'assistant';
  const isUser = message.role === 'user';

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content || '');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1300);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      {isAssistant && <img className="message-avatar" src="/icon.jpg" alt="DRAK-GPT" />}
      <div className="message-bubble">
        <div className="message-meta">
          <strong>{isUser ? 'Bos' : 'DRAK-GPT'}</strong>
          <span>{dateLabel(message.createdAt)}</span>
        </div>

        {message.loading ? (
          <div className="typing-indicator" aria-label="DRAK-GPT sedang mengetik">
            <span /><span /><span />
          </div>
        ) : (
          <MarkdownLite content={message.content} />
        )}

        {message.attachments?.length ? (
          <div className="message-attachments">
            {message.attachments.map((attachment) => (
              <div className="message-attachment" key={attachment.id}>
                {attachment.kind === 'image' ? <img src={attachment.preview} alt={attachment.name} /> : <span>{attachment.kind === 'text' ? 'TXT' : 'FILE'}</span>}
                <small>{attachment.name}</small>
              </div>
            ))}
          </div>
        ) : null}

        {!message.loading && (
          <div className="bubble-actions">
            <button type="button" onClick={copy}>{copied ? 'Disalin' : 'Copy'}</button>
            {message.error && <button type="button" onClick={onRetry}>Coba Lagi</button>}
          </div>
        )}
      </div>
    </article>
  );
}
