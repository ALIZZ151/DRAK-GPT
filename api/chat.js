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

  return messages;
}

function extractReply(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload.trim();

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
    if (value) return value;
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

  const body = { messages };
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
