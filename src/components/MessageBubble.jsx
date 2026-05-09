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

function languageLabel(language = '') {
  const lang = String(language || '').trim().toLowerCase();
  const map = {
    js: 'JavaScript',
    jsx: 'React JSX',
    javascript: 'JavaScript',
    ts: 'TypeScript',
    tsx: 'React TSX',
    typescript: 'TypeScript',
    py: 'Python',
    python: 'Python',
    bash: 'Bash',
    sh: 'Shell',
    zsh: 'Zsh',
    html: 'HTML',
    css: 'CSS',
    json: 'JSON',
    md: 'Markdown',
    markdown: 'Markdown',
    php: 'PHP',
    sql: 'SQL',
    java: 'Java',
    go: 'Go',
    rust: 'Rust',
    rb: 'Ruby',
    ruby: 'Ruby',
    vue: 'Vue',
    react: 'React',
    env: 'ENV',
    dotenv: 'ENV'
  };
  return map[lang] || (lang ? lang.toUpperCase() : 'CODE');
}

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);
  const cleanCode = String(code || '').replace(/^\n/, '').replace(/\n$/, '');

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(cleanCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1300);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="code-block">
      <div className="code-block-toolbar">
        <span>{languageLabel(language)}</span>
        <button type="button" onClick={copyCode} aria-label="Copy code block">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code>{cleanCode}</code>
      </pre>
    </div>
  );
}

function parseMarkdownBlocks(content = '') {
  const text = String(content || '');
  const parts = [];
  const regex = /```([^\n`]*)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }

    const rawLang = (match[1] || '').trim();
    const code = match[2] || '';
    parts.push({ type: 'code', language: rawLang, value: code });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts.length ? parts : [{ type: 'text', value: text }];
}

function TextBlock({ block, blockIndex }) {
  return String(block || '')
    .split('\n')
    .map((line, lineIndex) => {
      const key = `${blockIndex}-${lineIndex}`;
      if (!line.trim()) return <br key={key} />;
      if (/^#{1,3}\s+/.test(line)) {
        return <h4 key={key}><InlineText text={line.replace(/^#{1,3}\s+/, '')} /></h4>;
      }
      if (/^[-*]\s+/.test(line)) {
        return <p className="list-line" key={key}>• <InlineText text={line.replace(/^[-*]\s+/, '')} /></p>;
      }
      if (/^\d+\.\s+/.test(line)) {
        return <p className="list-line" key={key}><InlineText text={line} /></p>;
      }
      return <p key={key}><InlineText text={line} /></p>;
    });
}

function MarkdownLite({ content }) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="markdown-lite">
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          return <CodeBlock key={index} code={block.value} language={block.language} />;
        }
        return <TextBlock key={index} block={block.value} blockIndex={index} />;
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
            <button type="button" onClick={copy}>{copied ? 'Disalin' : 'Copy Jawaban'}</button>
            {message.error && <button type="button" onClick={onRetry}>Coba Lagi</button>}
          </div>
        )}
      </div>
    </article>
  );
}
