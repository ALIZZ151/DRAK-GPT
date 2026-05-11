import { APP_CONFIG } from '../src/database.js';

const MAX_MESSAGE_LENGTH = APP_CONFIG.limits.maxMessageLength || 12000;
const DEFAULT_TIMEOUT_MS = APP_CONFIG.limits.providerTimeoutMs || 20000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 22;
const MAX_HISTORY_MESSAGES = 12;
const isProd = process.env.NODE_ENV === 'production';
const rateStore = globalThis.__DRAK_RATE_STORE__ || new Map();
globalThis.__DRAK_RATE_STORE__ = rateStore;

const WORMGPT_API_URL = process.env.WORMGPT_API_URL || APP_CONFIG.providers?.[0]?.url || 'https://api.wormgpt.pw/v1/chat/completions';
const WORMGPT_API_KEY = process.env.WORMGPT_API_KEY || process.env.DRAK_PROVIDER_API_KEY || '';
const WORMGPT_MODEL = process.env.WORMGPT_MODEL || '';
const ENABLE_FORMAT_INSTRUCTION = process.env.DRAK_FORMAT_RESPONSES !== 'false';
const FORMAT_SYSTEM_MESSAGE = [
  'Jawab langsung dengan format Markdown yang rapi dan mudah dibaca.',
  'Kalau memberi kode, selalu bungkus kode di fenced code block triple backticks dan tulis bahasa kodenya, contoh ```javascript.',
  'Pisahkan penjelasan singkat dari kode. Jangan tampilkan potongan mentah seperti data:, JSON provider, atau metadata API.'
].join(' ');

function logWarn(...args) {
  if (!isProd) console.warn('[DRAK-GPT]', ...args);
}

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function getIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return Array.isArray(forwarded) ? forwarded[0] : String(forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function checkRateLimit(req) {
  const ip = getIp(req);
  const now = Date.now();
  const record = rateStore.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + RATE_WINDOW_MS;
  }

  record.count += 1;
  rateStore.set(ip, record);

  for (const [key, value] of rateStore.entries()) {
    if (now > value.resetAt + RATE_WINDOW_MS) rateStore.delete(key);
  }

  return record.count <= RATE_LIMIT;
}

function sanitizeMessage(message) {
  return String(message || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

function clampText(text, max) {
  const clean = sanitizeMessage(text);
  return clean.length > max ? clean.slice(0, max) : clean;
}

function parseJsonSafe(text) {
  const clean = String(text || '').trim();
  if (!clean) return null;
  try {
    return JSON.parse(clean);
  } catch {
    return clean;
  }
}

function normalizeRole(role) {
  return role === 'assistant' ? 'assistant' : 'user';
}

function normalizeHistory(history = []) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && sanitizeMessage(item.content))
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      role: normalizeRole(item.role),
      content: clampText(item.content, 4000)
    }));
}

function buildMessages({ history, message }) {
  const messages = normalizeHistory(history);
  const last = messages[messages.length - 1];

  // Hindari duplikat kalau frontend sudah mengirim pesan terakhir di history.
  if (!last || last.role !== 'user' || last.content !== message) {
    messages.push({ role: 'user', content: message });
  }

  if (ENABLE_FORMAT_INSTRUCTION) {
    return [{ role: 'system', content: FORMAT_SYSTEM_MESSAGE }, ...messages];
  }

  return messages;
}

function guessCodeLanguage(code = '') {
  const text = String(code || '').trim();
  if (!text) return '';
  if (/^\s*[{[]/.test(text) && /[}\]]\s*$/.test(text)) return 'json';
  if (/<(html|body|div|section|script|style|!doctype)\b/i.test(text)) return 'html';
  if (/^\s*<\?php|\b(function|echo|namespace|use)\b.*\$/m.test(text)) return 'php';
  if (/\b(import React|from ['"]react|useState\(|jsx|className=|export default function)\b/.test(text)) return 'jsx';
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

function looksLikeCodeBlock(block = '') {
  const lines = String(block || '').split('\n').map((line) => line.trimEnd()).filter((line) => line.trim());
  if (!lines.length) return false;
  if (lines.length === 1) {
    const one = lines[0];
    return one.length > 28 && codeLineScore(one) >= 2;
  }
  const score = lines.reduce((total, line) => total + (codeLineScore(line) > 0 ? 1 : 0), 0);
  return score >= Math.max(2, Math.ceil(lines.length * 0.45));
}

function wrapLooseCodeBlocks(text = '') {
  const raw = String(text || '').trim();
  if (!raw || raw.includes('```')) return raw;

  if (looksLikeCodeBlock(raw)) {
    return `\`\`\`${guessCodeLanguage(raw)}\n${raw}\n\`\`\``;
  }

  return raw
    .split(/\n{2,}/)
    .map((block) => {
      const clean = block.trim();
      if (!looksLikeCodeBlock(clean)) return clean;
      return `\`\`\`${guessCodeLanguage(clean)}\n${clean}\n\`\`\``;
    })
    .join('\n\n');
}

function normalizeMarkdownReply(text = '') {
  return wrapLooseCodeBlocks(String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim());
}

function parseSseReply(text) {
  const raw = String(text || '').trim();
  if (!raw.includes('data:')) return '';

  const parts = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;

    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') continue;

    const payload = parseJsonSafe(data);
    if (typeof payload === 'string') {
      parts.push(payload);
      continue;
    }

    const choice = payload?.choices?.[0];
    const candidates = [
      payload?.content,
      payload?.text,
      payload?.message,
      payload?.response,
      payload?.reply,
      payload?.data?.content,
      payload?.data?.text,
      payload?.data?.message,
      payload?.data?.response,
      payload?.data?.reply,
      payload?.result?.content,
      payload?.result?.text,
      choice?.delta?.content,
      choice?.message?.content,
      choice?.text
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        parts.push(candidate);
        break;
      }
    }
  }

  return normalizeMarkdownReply(sanitizeMessage(parts.join('')));
}

function extractReply(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') {
    return normalizeMarkdownReply(parseSseReply(payload) || sanitizeMessage(payload));
  }

  const choice = payload?.choices?.[0];
  const candidates = [
    choice?.message?.content,
    choice?.text,
    payload?.reply,
    payload?.message,
    payload?.answer,
    payload?.response,
    payload?.text,
    payload?.content,
    payload?.data?.reply,
    payload?.data?.message,
    payload?.data?.answer,
    payload?.data?.response,
    payload?.data?.text,
    payload?.data?.content,
    payload?.result?.reply,
    payload?.result?.message,
    payload?.result?.answer,
    payload?.result?.response,
    payload?.result?.text,
    payload?.result?.content
  ];

  for (const candidate of candidates) {
    const value = sanitizeMessage(candidate);
    if (value) return normalizeMarkdownReply(value);
  }

  return '';
}

async function readBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;

  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(parseJsonSafe(data) || {}));
  });
}

async function callWormGpt({ messages, signal }) {
  if (!WORMGPT_API_KEY) {
    throw new Error('API key belum diset. Tambahkan WORMGPT_API_KEY atau DRAK_PROVIDER_API_KEY di Environment Variables.');
  }

  const body = { messages, stream: false };
  if (WORMGPT_MODEL) body.model = WORMGPT_MODEL;

  const response = await fetch(WORMGPT_API_URL, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${WORMGPT_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain;q=0.9'
    },
    body: JSON.stringify(body)
  });

  const raw = await response.text();
  const payload = parseJsonSafe(raw);

  if (!response.ok) {
    const detail = typeof payload === 'object' ? (payload?.error?.message || payload?.message || payload?.error) : raw;
    throw new Error(`Provider HTTP ${response.status}${detail ? `: ${sanitizeMessage(detail).slice(0, 180)}` : ''}`);
  }

  const reply = extractReply(payload);
  if (!reply) throw new Error('Provider mengembalikan jawaban kosong/format tidak dikenali.');

  return {
    reply,
    rawPayload: payload
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 200, { success: true });
  if (req.method !== 'POST') return json(res, 405, { success: false, reply: 'Method tidak didukung.' });

  if (!checkRateLimit(req)) {
    return json(res, 429, { success: false, reply: 'Request terlalu cepat. Tunggu sebentar dulu.' });
  }

  const body = await readBody(req);
  const message = clampText(body?.message, MAX_MESSAGE_LENGTH);
  const requestedModel = sanitizeMessage(body?.model || 'instant');
  const model = APP_CONFIG.models.some((item) => item.id === requestedModel) ? requestedModel : 'instant';
  const chatId = sanitizeMessage(body?.chatId || '');
  const history = Array.isArray(body?.history) ? body.history : [];

  if (!message) {
    return json(res, 400, { success: false, model, reply: 'Pesan masih kosong.' });
  }

  const messages = buildMessages({ history, message });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const started = Date.now();

  try {
    const result = await callWormGpt({ messages, signal: controller.signal });

    return json(res, 200, {
      success: true,
      model,
      provider: 'wormgpt',
      providerLabel: 'WormGPT Chat Completions',
      chatId,
      reply: result.reply,
      responseTime: `${Date.now() - started}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? `Provider timeout > ${DEFAULT_TIMEOUT_MS}ms`
      : error?.message || 'Provider error';

    logWarn('provider failed', message);
    return json(res, 200, {
      success: false,
      model,
      provider: 'wormgpt',
      providerLabel: 'WormGPT Chat Completions',
      chatId,
      reply: `Provider AI belum bisa jawab. ${message}`,
      timestamp: new Date().toISOString()
    });
  } finally {
    clearTimeout(timeout);
  }
}
