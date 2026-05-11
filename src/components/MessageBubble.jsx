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
    dotenv: 'ENV',
    txt: 'CODE'
  };
  return map[lang] || (lang ? lang.toUpperCase() : 'CODE');
}

function detectLanguage(code = '') {
  const text = String(code || '').trim();
  if (!text) return '';
  if (/^\s*[{[]/.test(text) && /[}\]]\s*$/.test(text)) return 'json';
  if (/<(html|body|div|section|script|style|!doctype)\b/i.test(text)) return 'html';
  if (/^\s*<\?php|\bnamespace\b|\becho\b.*\$/m.test(text)) return 'php';
  if (/\b(import React|from ['"]react|useState\(|className=|export default function)\b/.test(text)) return 'jsx';
  if (/\b(const|let|var|function|=>|console\.log|document\.|module\.exports|export default)\b/.test(text)) return 'javascript';
  if (/\b(def|print\(|import [a-zA-Z_][\w.]*|from [a-zA-Z_][\w.]* import|if __name__ == ['"]__main__['"])\b/.test(text)) return 'python';
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/i.test(text)) return 'sql';
  if (/^\s*[A-Z0-9_]+=.*/m.test(text)) return 'env';
  if (/^\s*(npm|pnpm|yarn|git|cd|mkdir|rm|cp|mv|curl)\b/m.test(text)) return 'bash';
  if (/^\s*[.#]?[\w-]+\s*\{|:\s*[^;]+;\s*$/m.test(text)) return 'css';
  return 'txt';
}

function codeLineScore(line = '') {
  const value = String(line || '').trim();
  if (!value) return 0;
  const patterns = [
    /^(import|export|const|let|var|function|class|return|if|else|for|while|switch|case|try|catch|async|await|def|from|print|echo|public|private|protected|static|namespace|use)\b/,
    /^(<\/?[a-zA-Z][^>]*>|<!doctype\b)/i,
    /^[{}\[\]();,]+;?$/,
    /^(#include|SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i,
    /^[A-Z0-9_]+=.+/,
    /[{};]|=>|<\/[a-zA-Z]+>|\bconsole\.log\b|\bclassName=/
  ];
  return patterns.reduce((score, pattern) => score + (pattern.test(value) ? 1 : 0), 0);
}

function looksLikeLooseCode(block = '') {
  const lines = String(block || '').split('\n').map((line) => line.trimEnd()).filter((line) => line.trim());
  if (!lines.length) return false;
  if (lines.length === 1) {
    return lines[0].length > 28 && codeLineScore(lines[0]) >= 2;
  }
  const score = lines.reduce((total, line) => total + (codeLineScore(line) > 0 ? 1 : 0), 0);
  return score >= Math.max(2, Math.ceil(lines.length * 0.45));
}

function splitLooseCodeBlocks(text = '') {
  const raw = String(text || '');
  if (!raw.trim()) return [{ type: 'text', value: raw }];

  const chunks = raw.split(/(\n{2,})/);
  const output = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    if (!chunk) continue;
    if (/^\n{2,}$/.test(chunk)) {
      if (output.length && output[output.length - 1].type === 'text') {
        output[output.length - 1].value += chunk;
      } else {
        output.push({ type: 'text', value: chunk });
      }
      continue;
    }

    if (looksLikeLooseCode(chunk)) {
      output.push({ type: 'code', language: detectLanguage(chunk), value: chunk.trim() });
    } else {
      output.push({ type: 'text', value: chunk });
    }
  }

  return output.length ? output : [{ type: 'text', value: raw }];
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
        <button type="button" onClick={copyCode} aria-label="Salin kode">
          {copied ? 'Disalin' : 'Salin Code'}
        </button>
      </div>
      <pre>
        <code>{cleanCode}</code>
      </pre>
    </div>
  );
}

function parseMarkdownBlocks(content = '') {
  const text = String(content || '').replace(/\r\n/g, '\n');
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
    parts.push({ type: 'code', language: rawLang || detectLanguage(code), value: code });
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
      {blocks.flatMap((block, index) => {
        if (block.type === 'code') {
          return [<CodeBlock key={`code-${index}`} code={block.value} language={block.language} />];
        }

        return splitLooseCodeBlocks(block.value).map((item, looseIndex) => {
          const key = `${index}-${looseIndex}`;
          if (item.type === 'code') {
            return <CodeBlock key={`loose-code-${key}`} code={item.value} language={item.language} />;
          }
          return <TextBlock key={`text-${key}`} block={item.value} blockIndex={key} />;
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
                {attachment.kind === 'image' ? <img src={(attachment.preview || attachment.previewUrl || attachment.dataUrl)} alt={attachment.name} /> : <span>{attachment.kind === 'text' ? 'TXT' : 'FILE'}</span>}
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
