import { asc, eq } from 'drizzle-orm';
import { APP_CONFIG } from '../config.js';
import { requireDb, schema } from './db/index.js';
import { decryptSecret, maskSecret } from './security.js';
import { cleanString, parseJsonSafe } from './http.js';

export function getMode(mode) {
  const modes = APP_CONFIG.ai.modes || {};
  return modes[mode] ? mode : APP_CONFIG.ai.defaultMode || 'default';
}

export function buildSystemPrompt(mode) {
  const selectedMode = getMode(mode);
  const modePrompt = APP_CONFIG.ai.modes?.[selectedMode]?.prompt || '';
  return [APP_CONFIG.ai.systemPrompt || '', modePrompt].join('\n\n').trim();
}

export function normalizeHistory(history = []) {
  const max = Number(APP_CONFIG.ai.maxHistoryMessages || 12);
  return Array.isArray(history)
    ? history
        .filter((item) => item && ['user', 'assistant'].includes(item.role) && cleanString(item.content, 4000))
        .slice(-max)
        .map((item) => ({ role: item.role, content: cleanString(item.content, 4000) }))
    : [];
}

export function buildMessages({ message, history, mode }) {
  const messages = [
    { role: 'system', content: buildSystemPrompt(mode) },
    ...normalizeHistory(history)
  ];
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user' || last.content !== message) messages.push({ role: 'user', content: message });
  return messages;
}

function normalizeMarkdownReply(reply) {
  const text = cleanString(reply, 60_000);
  if (!text) return '';
  if (text.includes('```')) return text;
  return text;
}

function parseSseReply(raw = '') {
  const parts = [];
  for (const line of String(raw).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const chunk = trimmed.slice(5).trim();
    if (!chunk || chunk === '[DONE]') continue;
    const payload = parseJsonSafe(chunk, null);
    if (!payload || typeof payload !== 'object') continue;
    const choice = payload.choices?.[0];
    const candidate = choice?.delta?.content || choice?.message?.content || choice?.text || payload.reply || payload.response || payload.text;
    if (typeof candidate === 'string') parts.push(candidate);
  }
  return parts.join('');
}

export function extractReply(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') return normalizeMarkdownReply(parseSseReply(payload) || payload);
  const choice = payload.choices?.[0];
  const candidates = [
    choice?.message?.content,
    choice?.text,
    payload.reply,
    payload.message,
    payload.answer,
    payload.response,
    payload.text,
    payload.content,
    payload.data?.reply,
    payload.data?.message,
    payload.data?.answer,
    payload.data?.response,
    payload.data?.text,
    payload.data?.content,
    payload.result?.reply,
    payload.result?.message,
    payload.result?.answer,
    payload.result?.response,
    payload.result?.text,
    payload.result?.content
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return normalizeMarkdownReply(candidate);
  }
  return '';
}

export async function getActiveApiKeys() {
  const { db } = requireDb();
  return db.select().from(schema.apiKeys)
    .where(eq(schema.apiKeys.status, 'active'))
    .orderBy(asc(schema.apiKeys.priority), asc(schema.apiKeys.createdAt));
}

async function markKeyError(keyId, error) {
  const { db } = requireDb();
  await db.update(schema.apiKeys).set({
    lastError: cleanString(error, 500),
    updatedAt: new Date()
  }).where(eq(schema.apiKeys.id, keyId));
}

async function markKeySuccess(keyId) {
  const { db, sql } = requireDb();
  await sql`
    update api_keys
    set total_used = total_used + 1,
        daily_used = daily_used + 1,
        last_error = null,
        last_used_at = now(),
        updated_at = now()
    where id = ${keyId}
  `;
}

export async function callAiWithFallback({ message, history, mode, signal }) {
  const keys = await getActiveApiKeys();
  if (!keys.length) {
    const fallbackKey = process.env.AI_DEFAULT_API_KEY || '';
    const fallbackUrl = process.env.AI_DEFAULT_API_URL || '';
    if (!fallbackKey || !fallbackUrl) throw new Error('Belum ada API key aktif. Tambahkan lewat admin panel.');
    keys.push({ id: null, label: 'Env Default', provider: 'openai-compatible', apiUrl: fallbackUrl, apiKeyEncrypted: null, rawKey: fallbackKey });
  }

  const body = { messages: buildMessages({ message, history, mode }), stream: false };
  if (process.env.AI_DEFAULT_MODEL) body.model = process.env.AI_DEFAULT_MODEL;
  let lastError = 'Provider error';

  for (const key of keys) {
    const apiUrl = key.apiUrl || key.api_url || process.env.AI_DEFAULT_API_URL;
    const encrypted = key.apiKeyEncrypted || key.api_key_encrypted;
    const apiKey = key.rawKey || decryptSecret(encrypted);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json, text/plain;q=0.9'
        },
        body: JSON.stringify(body)
      });
      const raw = await response.text();
      const payload = parseJsonSafe(raw, raw);
      if (!response.ok) {
        const detail = typeof payload === 'object' ? (payload?.error?.message || payload?.message || payload?.error) : raw;
        throw new Error(`HTTP ${response.status}${detail ? `: ${cleanString(detail, 180)}` : ''}`);
      }
      const reply = extractReply(payload);
      if (!reply) throw new Error('Provider mengembalikan jawaban kosong.');
      if (key.id) await markKeySuccess(key.id);
      return {
        reply,
        provider: key.provider || 'openai-compatible',
        apiKeyId: key.id,
        apiKeyLabel: key.label,
        maskedKey: key.rawKey ? maskSecret(key.rawKey) : 'encrypted********key'
      };
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      lastError = error?.message || 'Provider error';
      if (key.id) await markKeyError(key.id, lastError).catch(() => null);
    }
  }

  throw new Error(`Semua API key gagal. ${cleanString(lastError, 160)}`);
}
