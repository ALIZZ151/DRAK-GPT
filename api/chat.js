import { APP_CONFIG, DRAK_SYSTEM_PROMPT, MODEL_INSTRUCTIONS } from '../src/database.js';

const MAX_MESSAGE_LENGTH = APP_CONFIG.limits.maxMessageLength || 8000;
const MAX_CONTEXT_CHARS = APP_CONFIG.limits.maxContextChars || 7800;
const MAX_FINAL_PROMPT_CHARS = APP_CONFIG.limits.maxPromptChars || 14000;
const MAX_PROVIDER_ATTEMPTS = APP_CONFIG.limits.maxProviderAttempts || 4;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 22;
const DEFAULT_TIMEOUT_MS = APP_CONFIG.limits.providerTimeoutMs || 9000;
const rateStore = globalThis.__DRAK_RATE_STORE__ || new Map();
globalThis.__DRAK_RATE_STORE__ = rateStore;

const PROVIDERS = Object.fromEntries(
  APP_CONFIG.providers.map((provider) => [provider.id, provider])
);

const MODEL_CHAINS = {
  instant: ['lexcode', 'nexray-gpt35', 'nexray-openai', 'nexray-gemini'],
  thinking: ['nexray-gemini', 'nexray-deepseek', 'nexray-heck', 'nexray-openai'],
  coding: ['nexray-heck', 'nexray-copilot', 'nexray-deepseek', 'nexray-gemini'],
  pro: ['nexray-heck', 'nexray-gemini', 'nexray-openai', 'nexray-deepseek', 'lexcode']
};

const INTENT_CHAINS = {
  coding: ['nexray-heck', 'nexray-copilot', 'nexray-deepseek', 'nexray-gemini', 'nexray-openai', 'lexcode'],
  math: ['nexray-mathgpt', 'nexray-gemini', 'nexray-openai', 'lexcode'],
  muslim: ['nexray-muslim', 'nexray-gemini', 'nexray-openai'],
  image_or_visual: ['nexray-veo2', 'nexray-gemini', 'nexray-openai', 'lexcode'],
  music_or_audio: ['nexray-suno', 'nexray-gemini', 'nexray-openai', 'lexcode'],
  thinking: ['nexray-gemini', 'nexray-deepseek', 'nexray-heck', 'nexray-openai'],
  general_chat: ['nexray-gemini', 'nexray-openai', 'nexray-gpt35', 'lexcode', 'nexray-nexray', 'nexray-gitagpt']
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

function stripCode(text = '') {
  return String(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ');
}

function clampText(text, max) {
  const clean = sanitizeMessage(text);
  return clean.length > max ? `${clean.slice(0, max)}\n...[dipotong biar prompt tetap aman]` : clean;
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function compactJson(value, max = 900) {
  try {
    const formatted = JSON.stringify(value, null, 2);
    if (!formatted || formatted === '{}' || formatted === '[]') return '';
    return formatted.length > max ? `${formatted.slice(0, max)}\n...` : formatted;
  } catch {
    return '';
  }
}

function findUrl(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = value.match(/https?:\/\/[^\s"'<>]+/);
    return match?.[0] || '';
  }
  if (Array.isArray(value)) return value.map(findUrl).find(Boolean) || '';
  if (typeof value === 'object') {
    for (const key of ['url', 'link', 'video', 'audio', 'image', 'file', 'download', 'media', 'result', 'data']) {
      const found = findUrl(value[key]);
      if (found) return found;
    }
  }
  return '';
}

function extractReply(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(extractReply).find(Boolean) || findUrl(value);
  if (typeof value === 'object') {
    const priorityPaths = [
      ['result', 'result'],
      ['data', 'result'],
      ['data', 'message'],
      ['data', 'answer'],
      ['data', 'response'],
      ['data', 'text'],
      ['result'],
      ['reply'],
      ['message'],
      ['answer'],
      ['response'],
      ['text'],
      ['output'],
      ['content']
    ];

    for (const path of priorityPaths) {
      let current = value;
      for (const key of path) current = current?.[key];
      const reply = extractReply(current);
      if (reply) return reply;
    }

    const mediaUrl = findUrl(value);
    if (mediaUrl) return mediaUrl;

    const asJson = compactJson(value);
    return asJson ? `Response provider:\n\`\`\`json\n${asJson}\n\`\`\`` : '';
  }
  return '';
}

function parseLexCode(payload) {
  const reply = payload?.result?.result || extractReply(payload);
  if (!reply) throw new Error('Provider reply kosong');
  return {
    reply,
    responseTime: payload?.result?.responseTime || null,
    timestamp: payload?.result?.timestamp || new Date().toISOString()
  };
}

function parseGeneric(payload) {
  const reply = extractReply(payload);
  if (!reply) throw new Error('Provider reply kosong');
  return {
    reply,
    responseTime: payload?.responseTime || payload?.time || payload?.duration || null,
    timestamp: payload?.timestamp || payload?.createdAt || new Date().toISOString()
  };
}

function parsePayload(provider, payload) {
  if (provider.parser === 'lexcode') return parseLexCode(payload);
  return parseGeneric(payload);
}

function detectIntent(message = '') {
  const text = String(message).toLowerCase();

  if (/(buat|bikin|fix|perbaiki|debug|source\s*code|full\s*code|kode lengkap|script|coding|website|web|bot|api|deploy|vercel|firebase|react|javascript|node\.?js|python|php|html|css|error|stack trace|console|npm|package\.json|vite|express|database|sql|firestore)/i.test(text)) {
    return 'coding';
  }

  if (/(matematika|math|hitung|rumus|aljabar|kalkulus|persamaan|integral|turunan|statistik|probabilitas|geometri|trigonometri)/i.test(text)) {
    return 'math';
  }

  if (/(islam|muslim|doa|hadits|hadis|quran|alquran|sholat|salat|zakat|puasa|ramadhan|fiqih|ustadz)/i.test(text)) {
    return 'muslim';
  }

  if (/(gambar|visual|image|foto|anime|poster|logo|desain|video|veo|generate\s*(image|gambar|video)|buatkan\s*(gambar|video)|render|thumbnail)/i.test(text)) {
    return 'image_or_visual';
  }

  if (/(lagu|musik|music|audio|suno|beat|instrumental|nyanyi|lirik|melodi|song)/i.test(text)) {
    return 'music_or_audio';
  }

  if (/(analisis|analyze|kenapa|mengapa|jelaskan detail|bedah|strategi|rencana|logic|logika)/i.test(text)) {
    return 'thinking';
  }

  return 'general_chat';
}

function isIndonesianInput(message = '') {
  const text = stripCode(message).toLowerCase();
  const indonesianWords = [
    'gw', 'gue', 'gua', 'lu', 'lo', 'bang', 'bos', 'kok', 'nih', 'dong', 'aja', 'banget', 'gimana', 'kenapa', 'buat', 'bikin', 'tolong', 'pakai', 'pake', 'nggak', 'ga', 'gak', 'tidak', 'yang', 'ini', 'itu', 'kalau', 'kalo', 'sama', 'dengan', 'dari', 'untuk', 'jadi', 'biar', 'error', 'web', 'website', 'kode', 'script'
  ];
  let score = 0;
  for (const word of indonesianWords) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(text)) score += 1;
  }
  return score >= 2 || /\b(apa|siapa|dimana|kapan|bagaimana|mengapa)\b/i.test(text);
}

function looksMostlyEnglish(reply = '') {
  const natural = stripCode(reply).toLowerCase().replace(/https?:\/\/\S+/g, ' ');
  const words = natural.match(/[a-zA-Z]{3,}/g) || [];
  if (words.length < 18) return false;

  const englishSet = new Set(['the', 'and', 'you', 'your', 'that', 'this', 'with', 'for', 'from', 'when', 'what', 'where', 'which', 'will', 'would', 'should', 'could', 'because', 'please', 'here', 'there', 'make', 'create', 'use', 'using', 'need', 'error', 'code', 'file', 'function', 'component']);
  const indonesianSet = new Set(['yang', 'dan', 'buat', 'bikin', 'untuk', 'dengan', 'kalau', 'kalo', 'karena', 'ini', 'itu', 'jadi', 'bisa', 'harus', 'jangan', 'pakai', 'pake', 'bos', 'lu', 'gue', 'gw', 'kode', 'file']);

  let english = 0;
  let indo = 0;
  for (const word of words) {
    if (englishSet.has(word)) english += 1;
    if (indonesianSet.has(word)) indo += 1;
  }

  return english >= 5 && english > indo * 2;
}

function getTimeoutForModel(model, intent) {
  if (model === 'instant') return 7500;
  if (model === 'pro') return 11_000;
  if (model === 'coding' || intent === 'coding') return 10_000;
  return DEFAULT_TIMEOUT_MS;
}

function uniqueChain(ids = []) {
  const seen = new Set();
  return ids.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return Boolean(PROVIDERS[id]);
  });
}

function getProviderChain(model, intent) {
  const intentChain = INTENT_CHAINS[intent] || [];
  const modelChain = MODEL_CHAINS[model] || MODEL_CHAINS.instant;

  // Intent khusus lebih penting dari model, tapi model tetap jadi fallback.
  if (['coding', 'math', 'muslim', 'image_or_visual', 'music_or_audio'].includes(intent)) {
    return uniqueChain([...intentChain, ...modelChain]).slice(0, MAX_PROVIDER_ATTEMPTS);
  }

  return uniqueChain([...modelChain, ...intentChain, ...INTENT_CHAINS.general_chat]).slice(0, MAX_PROVIDER_ATTEMPTS);
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

function getModeInstruction(model, intent) {
  const base = MODEL_INSTRUCTIONS[model] || MODEL_INSTRUCTIONS.instant;
  if (intent === 'coding' && model !== 'coding') {
    return `${base}\n\n[MODE AUTO: CODING]\n${MODEL_INSTRUCTIONS.coding}`;
  }
  if (intent === 'math') {
    return `${base}\n\n[MODE AUTO: MATH]\nJawab perhitungan dengan langkah jelas. Jangan sok yakin kalau datanya kurang.`;
  }
  if (intent === 'muslim') {
    return `${base}\n\n[MODE AUTO: MUSLIM]\nJawab hati-hati. Kalau perkara agama butuh rujukan kuat dan kamu tidak yakin, bilang belum bisa pastiin.`;
  }
  if (intent === 'image_or_visual') {
    return `${base}\n\n[MODE AUTO: VISUAL]\nKalau provider visual tidak mengembalikan URL/media valid, jangan klaim gambar/video berhasil dibuat. Bantu rapikan prompt visualnya.`;
  }
  if (intent === 'music_or_audio') {
    return `${base}\n\n[MODE AUTO: AUDIO]\nKalau provider audio tidak mengembalikan URL/media valid, jangan klaim lagu berhasil dibuat. Bantu rapikan prompt audio/musiknya.`;
  }
  return base;
}

function buildPrompt({ systemPrompt, history, userMessage, model, intent, forceIndonesian = false }) {
  const context = trimHistoryForPrompt(history);
  const languageRule = isIndonesianInput(userMessage) || forceIndonesian
    ? 'Jawab menggunakan bahasa Indonesia gaul/tongkrongan. Jangan membalas bahasa Inggris kecuali user minta. Istilah coding boleh tetap English, penjelasan tetap Indonesia.'
    : 'Jawab menggunakan bahasa yang sama dengan user. Kalau user pakai Inggris, boleh jawab Inggris. Kalau user campur, ikuti bahasa dominan user.';

  const codingFormat = intent === 'coding'
    ? [
      '[FORMAT WAJIB KALAU CODING]',
      '1. Pembuka singkat gaya DRAK-GPT.',
      '2. Penjelasan singkat fungsi solusi.',
      '3. Berikan kode lengkap dalam markdown code block.',
      '4. Cara menjalankan.',
      '5. Catatan penting kalau ada.',
      'Jangan kasih kode receh yang tidak menyelesaikan kebutuhan user.'
    ].join('\n')
    : '';

  const sections = [
    '[IDENTITAS AI]',
    systemPrompt,
    '',
    '[MODE AKTIF]',
    getModeInstruction(model, intent),
    '',
    '[BAHASA WAJIB]',
    languageRule,
    '',
    '[ANTI HALUSINASI]',
    'Jangan mengarang. Kalau data kurang, bilang data kurang. Kalau tidak tahu, bilang tidak tahu. Jawab sesuai konteks chat. Jangan sok yakin kalau belum pasti.',
    '',
    '[KONTEKS CHAT TERAKHIR]',
    context || 'Belum ada konteks sebelumnya.',
    '',
    codingFormat,
    codingFormat ? '' : null,
    '[PESAN USER]',
    clampText(userMessage, MAX_MESSAGE_LENGTH + 12_000),
    '',
    '[ARAHAN OUTPUT]',
    'Balas sebagai DRAK-GPT. Gaya tajam, santai, berguna, dan jangan ngawur.'
  ].filter(Boolean);

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
    /^As an? AI language model[^,.]*[,.]?\s*/i,
    /^Mohon maaf sebesar-besarnya[,.]?\s*/i,
    /^I'?m sorry[,.]?\s*/i
  ];

  for (const pattern of formalStarts) {
    reply = reply.replace(pattern, '');
  }

  if (!reply.trim()) {
    return 'Provider-nya ngasih jawaban kosong, Bos. Coba ulangi, ini API-nya lagi bengong.';
  }

  return reply.trim();
}

function buildProviderUrl(provider, finalPrompt) {
  const url = new URL(provider.url);
  url.searchParams.set(provider.param || 'text', finalPrompt);

  if (provider.extraParams && typeof provider.extraParams === 'object') {
    for (const [key, value] of Object.entries(provider.extraParams)) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

async function callProvider(provider, finalPrompt, timeoutMs) {
  if (!provider || provider.enabled === false) throw new Error('Provider belum aktif');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const fetchOptions = {
      method: provider.method || 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json, text/plain;q=0.9' }
    };

    let url = provider.url;
    if ((provider.method || 'GET').toUpperCase() === 'POST') {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify({ message: finalPrompt, text: finalPrompt, prompt: finalPrompt });
    } else {
      url = buildProviderUrl(provider, finalPrompt);
    }

    const response = await fetch(url, fetchOptions);
    const raw = await response.text();
    if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);

    const payload = parseJsonSafe(raw);
    const parsed = parsePayload(provider, payload);
    return {
      ...parsed,
      reply: cleanReply(parsed.reply),
      responseTime: parsed.responseTime || `${Date.now() - started}ms`
    };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`Provider timeout > ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function errorFallbackForIntent(intent) {
  if (intent === 'image_or_visual') return 'Provider visual lagi gak bisa dipakai, Bos. Prompt lu udah gue siapin, coba ulangi bentar lagi.';
  if (intent === 'music_or_audio') return 'Provider audio lagi pada ngambek, Bos. Coba ulangi sebentar lagi.';
  return 'Provider AI lagi pada ngambek, Bos. Coba ulangi sebentar lagi.';
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
  const requestedModel = sanitizeMessage(body.model || 'instant');
  const model = MODEL_CHAINS[requestedModel] ? requestedModel : 'instant';
  const chatId = sanitizeMessage(body.chatId || '');
  const history = Array.isArray(body.history) ? body.history : [];
  const intent = detectIntent(message);
  const shouldUseIndonesian = isIndonesianInput(message);

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

  const basePrompt = buildPrompt({
    systemPrompt: APP_CONFIG.systemPrompt || DRAK_SYSTEM_PROMPT,
    history,
    userMessage: message,
    model,
    intent
  });

  const chain = getProviderChain(model, intent);
  const timeoutMs = getTimeoutForModel(model, intent);
  const errors = [];

  for (const providerId of chain) {
    const provider = PROVIDERS[providerId];
    if (!provider) continue;
    try {
      let result = await callProvider(provider, basePrompt, timeoutMs);

      if (shouldUseIndonesian && looksMostlyEnglish(result.reply)) {
        try {
          const retryPrompt = buildPrompt({
            systemPrompt: APP_CONFIG.systemPrompt || DRAK_SYSTEM_PROMPT,
            history,
            userMessage: `${message}\n\n[ULANGI JAWABAN]\nJawaban sebelumnya salah bahasa. Ulangi dalam bahasa Indonesia gaul/tongkrongan. Jangan translate kode, command, nama function, atau error asli.`,
            model,
            intent,
            forceIndonesian: true
          });
          const retryResult = await callProvider(provider, retryPrompt, Math.min(6000, timeoutMs));
          if (retryResult?.reply && !looksMostlyEnglish(retryResult.reply)) {
            result = retryResult;
          }
        } catch (retryError) {
          errors.push({ provider: providerId, message: `language retry: ${retryError.message}` });
        }
      }

      return json(res, 200, {
        success: true,
        model,
        intent,
        provider: provider.id,
        providerLabel: provider.label,
        chatId,
        reply: result.reply,
        responseTime: result.responseTime,
        timestamp: result.timestamp,
        fallbackTried: errors.map((item) => item.provider)
      });
    } catch (error) {
      errors.push({ provider: providerId, message: error.message });
    }
  }

  return json(res, 200, {
    success: false,
    model,
    intent,
    provider: null,
    chatId,
    reply: `${errorFallbackForIntent(intent)}\n\nKalau error terus, hubungi owner.`,
    timestamp: new Date().toISOString(),
    fallbackTried: errors.map((item) => item.provider)
  });
}
