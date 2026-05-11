import crypto from 'node:crypto';
import { APP_CONFIG } from '../src/database.js';

const MAX_MESSAGE_LENGTH = APP_CONFIG.limits.maxMessageLength || 12000;
const DEFAULT_TIMEOUT_MS = APP_CONFIG.limits.providerTimeoutMs || 20000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 22;
const MAX_HISTORY_MESSAGES = 12;
const isProd = process.env.NODE_ENV === 'production';
const rateStore = globalThis.__DRAK_RATE_STORE__ || new Map();
globalThis.__DRAK_RATE_STORE__ = rateStore;

const DEFAULT_WORMGPT_API_URL = APP_CONFIG.providers?.[0]?.url || 'https://api.wormgpt.pw/v1/chat/completions';
const WORMGPT_MODEL = process.env.WORMGPT_MODEL || '';
const ENABLE_FORMAT_INSTRUCTION = process.env.DRAK_FORMAT_RESPONSES !== 'false';
const ACCESS_ENABLED = process.env.DRAK_ACCESS_ENABLED !== 'false';
const ACCESS_KEY = String(process.env.DRAK_ACCESS_KEY || process.env.DRAK_LOGIN_KEY || process.env.ACCESS_KEY || '').trim();
const ACCESS_PASSWORD = String(process.env.DRAK_ACCESS_PASSWORD || process.env.DRAK_LOGIN_PASSWORD || process.env.ACCESS_PASSWORD || '').trim();
const ACCESS_TOKEN_SECRET = String(process.env.DRAK_ACCESS_TOKEN_SECRET || `${ACCESS_KEY}:${ACCESS_PASSWORD}:${process.env.VERCEL_GIT_COMMIT_SHA || 'drak-gpt'}`).trim();
const FORMAT_SYSTEM_MESSAGE = [
  'Jawab langsung dengan format Markdown yang rapi dan mudah dibaca.',
  'Kalau memberi kode, selalu bungkus kode di fenced code block triple backticks dan tulis bahasa kodenya, contoh ```javascript.',
  'Pisahkan penjelasan singkat dari kode. Jangan tampilkan potongan mentah seperti data:, JSON provider, atau metadata API.'
].join(' ');

function logWarn(...args) {
  if (!isProd) console.warn('[DRAK-GPT]', ...args);
}

function unique(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function splitEnvList(value = '') {
  return String(value || '')
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getProviderConfigs() {
  const keys = unique([
    ...splitEnvList(process.env.WORMGPT_API_KEYS),
    process.env.WORMGPT_API_KEY,
    process.env.DRAK_PROVIDER_API_KEY,
    process.env.WORMGPT_API_KEY_1,
    process.env.WORMGPT_API_KEY_2,
    process.env.WORMGPT_API_KEY_3,
    process.env.WORMGPT_API_KEY_4,
    process.env.WORMGPT_API_KEY_5
  ]);

  const urls = unique([
    ...splitEnvList(process.env.WORMGPT_API_URLS),
    process.env.WORMGPT_API_URL,
    process.env.WORMGPT_API_URL_1,
    process.env.WORMGPT_API_URL_2,
    process.env.WORMGPT_API_URL_3,
    DEFAULT_WORMGPT_API_URL
  ]);

  return keys.map((key, index) => ({
    key,
    url: process.env[`WORMGPT_API_URL_${index + 1}`] || urls[index] || urls[0] || DEFAULT_WORMGPT_API_URL,
    index: index + 1
  }));
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function signAccessPayload(payloadEncoded) {
  return crypto.createHmac('sha256', ACCESS_TOKEN_SECRET).update(payloadEncoded).digest('base64url');
}

function verifyAccessToken(token) {
  if (!ACCESS_ENABLED) return true;
  if (!ACCESS_KEY || !ACCESS_PASSWORD) return false;

  const [payloadEncoded, signature] = String(token || '').split('.');
  if (!payloadEncoded || !signature) return false;
  if (!safeEqual(signature, signAccessPayload(payloadEncoded))) return false;

  try {
    const payload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString('utf8'));
    return payload?.app === 'drak-gpt' && Number(payload?.exp || 0) > Date.now();
  } catch {
    return false;
  }
}

function getAccessTokenFromRequest(req) {
  const direct = req.headers['x-drak-access-token'];
  if (Array.isArray(direct)) return direct[0] || '';
  if (direct) return String(direct);

  const authorization = req.headers.authorization || '';
  const auth = Array.isArray(authorization) ? authorization[0] : String(authorization);
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
}

function checkAccess(req) {
  if (!ACCESS_ENABLED) return { ok: true };
  if (!ACCESS_KEY || !ACCESS_PASSWORD) {
    return {
      ok: false,
      status: 500,
      reply: 'Access gate belum diset. Tambahkan DRAK_ACCESS_KEY dan DRAK_ACCESS_PASSWORD di Vercel Environment Variables.'
    };
  }

  if (!verifyAccessToken(getAccessTokenFromRequest(req))) {
    return {
      ok: false,
      status: 401,
      reply: 'Access token tidak valid atau sudah expired. Silakan login ulang.'
    };
  }

  return { ok: true };
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
  const providers = getProviderConfigs();
  if (!providers.length) {
    throw new Error('API key belum diset. Tambahkan WORMGPT_API_KEY, WORMGPT_API_KEY_2, atau WORMGPT_API_KEYS di Environment Variables.');
  }

  const body = { messages, stream: false };
  if (WORMGPT_MODEL) body.model = WORMGPT_MODEL;

  let lastError = '';

  for (const provider of providers) {
    try {
      const response = await fetch(provider.url, {
        method: 'POST',
        signal,
        headers: {
          Authorization: `Bearer ${provider.key}`,
          'Content-Type': 'application/json',
          Accept: 'application/json, text/plain;q=0.9'
        },
        body: JSON.stringify(body)
      });

      const raw = await response.text();
      const payload = parseJsonSafe(raw);

      if (!response.ok) {
        const detail = typeof payload === 'object' ? (payload?.error?.message || payload?.message || payload?.error) : raw;
        throw new Error(`Key #${provider.index} HTTP ${response.status}${detail ? `: ${sanitizeMessage(detail).slice(0, 180)}` : ''}`);
      }

      const reply = extractReply(payload);
      if (!reply) throw new Error(`Key #${provider.index} mengembalikan jawaban kosong/format tidak dikenali.`);

      return {
        reply,
        providerIndex: provider.index,
        rawPayload: payload
      };
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      lastError = error?.message || `Key #${provider.index} gagal.`;
      logWarn('provider failed, trying next key', lastError);
    }
  }

  throw new Error(`Semua API key gagal. Terakhir: ${lastError || 'Provider error'}`);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 200, { success: true });
  if (req.method !== 'POST') return json(res, 405, { success: false, reply: 'Method tidak didukung.' });

  const access = checkAccess(req);
  if (!access.ok) {
    return json(res, access.status || 401, { success: false, code: 'ACCESS_DENIED', reply: access.reply });
  }

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
      providerLabel: `WormGPT Chat Completions #${result.providerIndex || 1}`,
      providerIndex: result.providerIndex || 1,
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
