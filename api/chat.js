import { APP_CONFIG, DRAK_SYSTEM_PROMPT, MODEL_INSTRUCTIONS } from '../src/database.js';

const MAX_MESSAGE_LENGTH = 8000;
const MAX_CONTEXT_CHARS = 7800;
const MAX_FINAL_PROMPT_CHARS = 14000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 22;
const TIMEOUT_MS = 15_000;
const rateStore = globalThis.__DRAK_RATE_STORE__ || new Map();
globalThis.__DRAK_RATE_STORE__ = rateStore;

const MODELS = {
  instant: ['lexcode', 'nexray-chatgpt'],
  thinking: ['nexray-deepseek', 'nexray-claude', 'lexcode'],
  coding: ['nexray-copilot', 'nexray-deepseek', 'lexcode'],
  pro: ['lexcode', 'nexray-chatgpt', 'nexray-claude', 'nexray-deepseek', 'nexray-copilot']
};

const PROVIDERS = {
  lexcode: {
    id: 'lexcode',
    label: 'LexCode GPT5 Nano',
    method: 'GET',
    url: 'https://api.lexcode.biz.id/api/ai/gpt5-nano?text={text}',
    parser: parseLexCode
  },
  'nexray-chatgpt': {
    id: 'nexray-chatgpt',
    label: 'Nexray ChatGPT',
    method: 'GET',
    url: 'https://api.nexray.eu.cc/ai/chatgpt?text={text}',
    parser: parseGeneric
  },
  'nexray-claude': {
    id: 'nexray-claude',
    label: 'Nexray Claude',
    method: 'GET',
    url: 'https://api.nexray.eu.cc/ai/claude?text={text}',
    parser: parseGeneric
  },
  'nexray-copilot': {
    id: 'nexray-copilot',
    label: 'Nexray Copilot',
    method: 'GET',
    url: 'https://api.nexray.eu.cc/ai/copilot?text={text}',
    parser: parseGeneric
  },
  'nexray-deepseek': {
    id: 'nexray-deepseek',
    label: 'Nexray Deepseek',
    method: 'GET',
    url: 'https://api.nexray.eu.cc/ai/deepseek?text={text}',
    parser: parseGeneric
  },
  dphn: {
    id: 'dphn',
    label: 'DPHN Chat API',
    method: 'POST',
    url: 'https://chat.dphn.ai/api/chat',
    parser: parseGeneric,
    enabled: false
  }
};

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
  return clean.length > max ? `${clean.slice(0, max)}\n...[dipotong biar prompt tetap aman]` : clean;
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function findReply(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(findReply).find(Boolean) || '';
  if (typeof value === 'object') {
    const keys = ['reply', 'result', 'response', 'answer', 'message', 'text', 'content', 'data', 'output'];
    for (const key of keys) {
      if (typeof value[key] === 'string' && value[key].trim()) return value[key];
      if (value[key] && typeof value[key] === 'object') {
        const nested = findReply(value[key]);
        if (nested) return nested;
      }
    }
  }
  return '';
}

function parseLexCode(payload) {
  const reply = payload?.result?.result || findReply(payload);
  if (!reply) throw new Error('Provider reply kosong');
  return {
    reply,
    responseTime: payload?.result?.responseTime || null,
    timestamp: payload?.result?.timestamp || new Date().toISOString()
  };
}

function parseGeneric(payload) {
  const reply = findReply(payload);
  if (!reply) throw new Error('Provider reply kosong');
  return {
    reply,
    responseTime: payload?.responseTime || payload?.time || null,
    timestamp: payload?.timestamp || new Date().toISOString()
  };
}

function trimHistoryForPrompt(history = [], maxChars = MAX_CONTEXT_CHARS) {
  const safeHistory = Array.isArray(history) ? history : [];
  const rows = safeHistory
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
    .slice(-10)
    .map((item) => {
      const label = item.role === 'assistant' ? 'DRAK-GPT' : 'User';
      return `${label}: ${clampText(item.content || '', 1200)}`;
    });

  const picked = [];
  let used = 0;
  for (const row of [...rows].reverse()) {
    if (used + row.length + 1 > maxChars) break;
    picked.unshift(row);
    used += row.length + 1;
  }
  return picked.join('\n');
}

function getModeInstruction(model) {
  return MODEL_INSTRUCTIONS[model] || MODEL_INSTRUCTIONS.instant;
}

function buildPrompt({ systemPrompt, history, userMessage, model }) {
  const context = trimHistoryForPrompt(history);
  const sections = [
    '[IDENTITAS AI]',
    systemPrompt,
    '',
    '[MODE AKTIF]',
    getModeInstruction(model),
    '',
    '[ANTI HALUSINASI]',
    'Jangan mengarang. Kalau data kurang, bilang data kurang. Kalau tidak tahu, bilang tidak tahu. Jawab sesuai konteks chat. Jangan sok yakin kalau belum pasti.',
    '',
    '[KONTEKS CHAT TERAKHIR]',
    context || 'Belum ada konteks sebelumnya.',
    '',
    '[PESAN USER]',
    clampText(userMessage, MAX_MESSAGE_LENGTH + 12_000),
    '',
    '[ARAHAN OUTPUT]',
    'Balas sebagai DRAK-GPT dalam bahasa Indonesia santai. Tetap tajam, berguna, dan jangan ngawur.'
  ];

  const prompt = sections.join('\n');
  return prompt.length > MAX_FINAL_PROMPT_CHARS
    ? `${prompt.slice(0, MAX_FINAL_PROMPT_CHARS)}\n...[konteks dipotong otomatis]`
    : prompt;
}

function cleanReply(rawReply) {
  let reply = sanitizeMessage(rawReply)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  if (!reply) {
    return 'Provider-nya ngasih jawaban kosong, Bos. Coba ulangi, ini API-nya lagi bengong.';
  }

  const formalStarts = [
    /^Baik, saya akan membantu Anda dengan senang hati[,.!]?\s*/i,
    /^Sebagai (sebuah )?(model )?AI[^,.]*[,.]?\s*/i,
    /^Mohon maaf sebesar-besarnya[,.]?\s*/i
  ];

  for (const pattern of formalStarts) {
    reply = reply.replace(pattern, '');
  }

  if (!reply.trim()) {
    return 'Provider-nya ngasih jawaban kosong, Bos. Coba ulangi, ini API-nya lagi bengong.';
  }

  return reply.trim();
}

async function callProvider(provider, finalPrompt) {
  if (provider.enabled === false) throw new Error('Provider belum aktif');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const encoded = encodeURIComponent(finalPrompt);
    const url = provider.url.replace('{text}', encoded);
    const fetchOptions = {
      method: provider.method,
      signal: controller.signal,
      headers: { 'Accept': 'application/json, text/plain;q=0.9' }
    };

    if (provider.method === 'POST') {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify({ message: finalPrompt, text: finalPrompt });
    }

    fetchOptions.headers['User-Agent'] = 'DRAK-GPT/1.1 (+https://vercel.app)';

    const response = await fetch(url, fetchOptions);
    const raw = await response.text();
    if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
    const payload = parseJsonSafe(raw);
    const parsed = provider.parser(payload);
    return {
      ...parsed,
      reply: cleanReply(parsed.reply),
      responseTime: parsed.responseTime || `${Date.now() - started}ms`
    };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 200, { success: true });
  if (req.method !== 'POST') return json(res, 405, { success: false, reply: 'Method tidak didukung.' });

  if (!checkRateLimit(req)) {
    return json(res, 429, {
      success: false,
      reply: 'Request terlalu cepat. Tunggu sebentar dulu biar server gak ngambek.'
    });
  }

  const body = typeof req.body === 'object' && req.body !== null ? req.body : await new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(parseJsonSafe(data)));
  });

  const message = sanitizeMessage(body.message);
  const model = MODELS[body.model] ? body.model : 'instant';
  const chatId = sanitizeMessage(body.chatId || '');
  const history = Array.isArray(body.history) ? body.history : [];

  if (!message) {
    return json(res, 400, {
      success: false,
      model,
      reply: 'Pesan masih kosong, Bos.'
    });
  }

  if (message.length > MAX_MESSAGE_LENGTH + 12_000) {
    return json(res, 413, {
      success: false,
      model,
      reply: 'Pesan terlalu panjang. Ringkas dulu biar DRAK-GPT bisa proses.'
    });
  }

  const finalPrompt = buildPrompt({
    systemPrompt: APP_CONFIG.systemPrompt || DRAK_SYSTEM_PROMPT,
    history,
    userMessage: message,
    model
  });

  const chain = MODELS[model];
  const errors = [];

  for (const providerId of chain) {
    const provider = PROVIDERS[providerId];
    if (!provider) continue;
    try {
      const result = await callProvider(provider, finalPrompt);
      return json(res, 200, {
        success: true,
        model,
        provider: provider.id,
        providerLabel: provider.label,
        chatId,
        reply: result.reply,
        responseTime: result.responseTime,
        timestamp: result.timestamp
      });
    } catch (error) {
      errors.push({ provider: providerId, message: error.message });
    }
  }

  return json(res, 200, {
    success: false,
    model,
    provider: null,
    chatId,
    reply: 'DRAK-GPT lagi agak berat, coba ulangi sebentar lagi.\n\nKalau error terus, hubungi owner.',
    timestamp: new Date().toISOString(),
    fallbackTried: errors.map((item) => item.provider)
  });
}
