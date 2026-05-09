import { APP_CONFIG, DRAK_SYSTEM_PROMPT, MODEL_INSTRUCTIONS } from '../src/database.js';

const MAX_MESSAGE_LENGTH = APP_CONFIG.limits.maxMessageLength || 8000;
const MAX_PROVIDER_ATTEMPTS = APP_CONFIG.limits.maxProviderAttempts || 4;
const DEFAULT_TIMEOUT_MS = APP_CONFIG.limits.providerTimeoutMs || 9000;
const GET_PROMPT_LIMIT = APP_CONFIG.limits.maxGetPromptChars || 2200;
const FULL_PROMPT_LIMIT = APP_CONFIG.limits.maxPromptChars || 7000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 22;
const MAX_ATTACHMENT_SIZE = APP_CONFIG.upload?.maxSizeBytes || 2 * 1024 * 1024;
const ALLOWED_MIMES = new Set(APP_CONFIG.upload?.allowedTypes || []);
const isProd = process.env.NODE_ENV === 'production';
const rateStore = globalThis.__DRAK_RATE_STORE__ || new Map();
globalThis.__DRAK_RATE_STORE__ = rateStore;

const PROVIDERS = Object.fromEntries(
  APP_CONFIG.providers.map((provider) => [provider.id, provider])
);

const MODEL_CHAINS = {
  instant: ['lexcode', 'nexray-gpt35', 'nexray-openai', 'nexray-gemini', 'nexray-chatgpt'],
  thinking: ['nexray-gemini', 'nexray-deepseek', 'nexray-heck', 'nexray-openai', 'nexray-claude'],
  coding: ['nexray-heck', 'nexray-copilot', 'nexray-deepseek', 'nexray-gemini', 'nexray-openai'],
  pro: ['nexray-heck', 'nexray-gemini', 'nexray-openai', 'nexray-deepseek', 'nexray-chatgpt', 'lexcode']
};

const INTENT_CHAINS = {
  coding: ['nexray-heck', 'nexray-copilot', 'nexray-deepseek', 'nexray-gemini', 'nexray-openai', 'lexcode'],
  error_debugging: ['nexray-heck', 'nexray-deepseek', 'nexray-gemini', 'nexray-openai', 'nexray-copilot'],
  prompt_making: ['nexray-gemini', 'nexray-openai', 'nexray-heck', 'nexray-gpt35'],
  long_text_analysis: ['nexray-gemini', 'nexray-openai', 'nexray-heck', 'nexray-gpt35'],
  math: ['nexray-mathgpt', 'nexray-gemini', 'nexray-openai', 'lexcode'],
  muslim: ['nexray-muslim', 'nexray-gemini', 'nexray-openai'],
  image_or_visual: ['nexray-veo2', 'nexray-gemini', 'nexray-openai'],
  music_or_audio: ['nexray-suno', 'nexray-gemini', 'nexray-openai'],
  vision_image_question: [],
  thinking: ['nexray-gemini', 'nexray-deepseek', 'nexray-heck', 'nexray-openai'],
  general_chat: ['nexray-gemini', 'nexray-openai', 'nexray-gpt35', 'nexray-chatgpt', 'lexcode', 'nexray-nexray', 'nexray-gitagpt']
};

function logInfo(...args) {
  if (!isProd) console.info('[DRAK-GPT]', ...args);
}

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
  const clean = String(text || '').trim();
  if (!clean) return '';
  try {
    return JSON.parse(clean);
  } catch {
    return clean;
  }
}

function isHtmlError(text = '') {
  const value = String(text || '').trim().toLowerCase();
  return value.startsWith('<!doctype html') || value.startsWith('<html') || /cloudflare|cf-ray|access denied|attention required/.test(value);
}

function isLowValueDataKurang(reply = '') {
  const value = sanitizeMessage(reply).toLowerCase().replace(/[.!?,]+$/g, '').trim();
  if (!value) return false;
  const dataKurang = /(maaf[,\s]*)?data (lu |kamu |anda )?(kurang|tidak cukup)|detail(nya)? masih kurang|informasi (kurang|tidak cukup)|butuh data lebih/i.test(value);
  return dataKurang && value.length < 180;
}

function isBadReply(reply = '') {
  const value = sanitizeMessage(reply).toLowerCase();
  if (!value) return true;
  if (value.length < 2) return true;
  if (isHtmlError(value)) return true;
  if (isLowValueDataKurang(value)) return true;
  const exactBad = new Set(['undefined', 'null', 'false', 'nan', '{}', '[]', '[object object]']);
  if (exactBad.has(value)) return true;
  return /jawaban kosong|diblokir server|blocked|forbidden|bad gateway|server error|service unavailable|gateway timeout|rate limit exceeded|too many requests|internal server error|cannot get\s+\//i.test(value);
}

function collectStrings(value, bucket = []) {
  if (value === null || value === undefined) return bucket;
  if (typeof value === 'string') {
    const text = value.trim();
    if (text && !isBadReply(text)) bucket.push(text);
    return bucket;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, bucket));
    return bucket;
  }
  if (typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, bucket));
  }
  return bucket;
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
  if (typeof value === 'string') return isBadReply(value) ? '' : value.trim();
  if (Array.isArray(value)) return value.map(extractReply).find(Boolean) || findUrl(value);
  if (typeof value === 'object') {
    const priorityPaths = [
      ['result', 'result'],
      ['result', 'message'],
      ['result', 'text'],
      ['result', 'answer'],
      ['data', 'result'],
      ['data', 'message'],
      ['data', 'text'],
      ['data', 'answer'],
      ['data', 'response'],
      ['data', 'content'],
      ['choices', 0, 'message', 'content'],
      ['choices', 0, 'text'],
      ['reply'],
      ['message'],
      ['answer'],
      ['response'],
      ['text'],
      ['output'],
      ['content'],
      ['ai'],
      ['generated_text'],
      ['result']
    ];

    for (const path of priorityPaths) {
      let current = value;
      for (const key of path) current = current?.[key];
      const reply = extractReply(current);
      if (reply) return reply;
    }

    const mediaUrl = findUrl(value);
    if (mediaUrl) return mediaUrl;

    const strings = collectStrings(value).sort((a, b) => b.length - a.length);
    return strings.find((text) => text.length > 12) || '';
  }
  return '';
}

function parsePayload(provider, payload) {
  const reply = provider.parser === 'lexcode'
    ? (payload?.result?.result || extractReply(payload))
    : extractReply(payload);

  if (isBadReply(reply)) throw new Error('Provider reply kosong/invalid');

  return {
    reply,
    responseTime: payload?.result?.responseTime || payload?.responseTime || payload?.time || payload?.duration || null,
    timestamp: payload?.result?.timestamp || payload?.timestamp || payload?.createdAt || new Date().toISOString()
  };
}

function normalizeAttachments(attachments = []) {
  if (!Array.isArray(attachments)) return [];
  return attachments.slice(0, APP_CONFIG.limits.maxAttachments || 4).map((item, index) => {
    const mime = sanitizeMessage(item?.mime || item?.type || '');
    const type = sanitizeMessage(item?.type || item?.kind || (mime.startsWith('image/') ? 'image' : 'file'));
    const size = Number(item?.size || 0);
    const name = sanitizeMessage(item?.name || `attachment-${index + 1}`);
    const dataUrl = typeof item?.dataUrl === 'string' ? item.dataUrl : '';
    return {
      id: sanitizeMessage(item?.id || `att-${index + 1}`),
      type: type === 'image' || mime.startsWith('image/') ? 'image' : type,
      kind: sanitizeMessage(item?.kind || type),
      name,
      mime,
      size,
      width: Number(item?.width || 0),
      height: Number(item?.height || 0),
      compressed: Boolean(item?.compressed),
      hasDataUrl: Boolean(dataUrl),
      dataUrl: dataUrl && dataUrl.length <= MAX_ATTACHMENT_SIZE * 1.5 ? dataUrl : ''
    };
  }).filter((item) => {
    if (item.size > MAX_ATTACHMENT_SIZE) return false;
    if (item.mime && ALLOWED_MIMES.size && !ALLOWED_MIMES.has(item.mime)) return false;
    return Boolean(item.name);
  });
}

function hasImageAttachment(attachments = []) {
  return attachments.some((item) => item.type === 'image' || item.mime?.startsWith('image/'));
}

function attachmentSummary(attachments = []) {
  if (!attachments.length) return '';
  return attachments.map((item) => {
    const size = item.size ? `${Math.ceil(item.size / 1024)}KB` : 'size unknown';
    if (item.type === 'image') return `- User mengirim gambar: ${item.name} (${item.mime || 'image'}, ${size}${item.width && item.height ? `, ${item.width}x${item.height}` : ''}${item.compressed ? ', sudah dikompres' : ''}). Vision endpoint belum aktif kecuali provider vision khusus tersedia.`;
    return `- User mengirim file: ${item.name} (${item.mime || item.type || 'file'}, ${size}).`;
  }).join('\n');
}

function wantsImageGeneration(message = '') {
  const text = String(message).toLowerCase().trim();
  return /^\/image\b/.test(text)
    || /^\/gambar\b/.test(text)
    || /\b(generate|buat|bikin|buatkan)\s+(gambar|image|visual|foto|poster|logo|video|anime|thumbnail)\b/i.test(text)
    || /\b(gambar|image|visual|video)\s+(dari prompt|pakai prompt)\b/i.test(text);
}

function detectIntent(message = '', attachments = []) {
  const text = String(message || '').toLowerCase();
  const imageAttached = hasImageAttachment(attachments);
  const longTextThreshold = APP_CONFIG.limits.longTextThreshold || 2500;

  if (imageAttached && !wantsImageGeneration(text)) return 'vision_image_question';
  if (wantsImageGeneration(text)) return 'image_or_visual';
  if (/(lagu|musik|music|audio|suno|beat|instrumental|nyanyi|lirik|melodi|song)/i.test(text)) return 'music_or_audio';
  if (/(matematika|math|hitung|rumus|aljabar|kalkulus|persamaan|integral|turunan|statistik|probabilitas|geometri|trigonometri)/i.test(text)) return 'math';
  if (/(islam|muslim|doa|hadits|hadis|quran|alquran|sholat|salat|zakat|puasa|ramadhan|fiqih|ustadz)/i.test(text)) return 'muslim';
  if (/(fix error|perbaiki error|debug|error log|stack trace|console error|npm error|build error|deploy error|vercel error|firebase error|uncaught|exception|syntaxerror|referenceerror|typeerror)/i.test(text)) return 'error_debugging';
  if (/(buatkan? prompt|bikin prompt|prompt update|prompt coding|prompt ai|prompt website|prompt yang kekunci)/i.test(text)) return 'prompt_making';
  if (/(buatkan?|buat|bikin|full\s*code|kode lengkap|source\s*code|script|coding|website|web app|landing page|bot|api|html|css|javascript|typescript|node\.?js|react|vite|python|php|express|database|sql|firestore|vercel|firebase).{0,40}(kode|script|web|website|bot|api|app|html|css|javascript|python|react|node|php|deploy|firebase|vercel)|\b(kode lengkap|source code|full code|html css js|react component)\b/i.test(text)) return 'coding';
  if (sanitizeMessage(message).length > longTextThreshold) return 'long_text_analysis';
  if (/(analisis|analyze|kenapa|mengapa|jelaskan detail|bedah|strategi|rencana|logic|logika|rangkum|ringkas|summarize)/i.test(text)) return 'thinking';
  return 'general_chat';
}

function isIndonesianInput(message = '') {
  const text = stripCode(message).toLowerCase();
  const indonesianWords = [
    'gw', 'gue', 'gua', 'lu', 'lo', 'bang', 'bos', 'kok', 'nih', 'dong', 'aja', 'banget', 'gimana', 'kenapa', 'buat', 'bikin', 'tolong', 'pakai', 'pake', 'nggak', 'ga', 'gak', 'tidak', 'yang', 'ini', 'itu', 'kalau', 'kalo', 'sama', 'dengan', 'dari', 'untuk', 'jadi', 'biar', 'error', 'web', 'website', 'kode', 'script', 'gambar'
  ];
  let score = 0;
  for (const word of indonesianWords) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(text)) score += 1;
  }
  return score >= 1 || /\b(apa|siapa|dimana|kapan|bagaimana|mengapa)\b/i.test(text);
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
  if (model === 'instant') return 7000;
  if (model === 'pro') return 11_000;
  if (model === 'coding' || intent === 'coding') return 10_000;
  return DEFAULT_TIMEOUT_MS;
}

function uniqueChain(ids = []) {
  const seen = new Set();
  return ids.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    const provider = PROVIDERS[id];
    return Boolean(provider && provider.enabled !== false);
  });
}

function getProviderChain(model, intent) {
  const intentChain = INTENT_CHAINS[intent] || [];
  const modelChain = MODEL_CHAINS[model] || MODEL_CHAINS.instant;
  if (['coding', 'error_debugging', 'prompt_making', 'long_text_analysis', 'math', 'muslim', 'image_or_visual', 'music_or_audio'].includes(intent)) {
    return uniqueChain([...intentChain, ...modelChain, ...INTENT_CHAINS.general_chat]).slice(0, MAX_PROVIDER_ATTEMPTS);
  }
  return uniqueChain([...modelChain, ...intentChain, ...INTENT_CHAINS.general_chat]).slice(0, MAX_PROVIDER_ATTEMPTS);
}

function trimHistoryForCompactPrompt(history = [], maxRows = 4, maxChars = 520) {
  const rows = (Array.isArray(history) ? history : [])
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
    .slice(-maxRows)
    .map((item) => `${item.role === 'assistant' ? 'DRAK-GPT' : 'User'}: ${clampText(item.content || '', 180)}`);

  const joined = rows.join('\n');
  return joined.length > maxChars ? `${joined.slice(-maxChars)}\n...[konteks lama dipotong]` : joined;
}

function trimHistoryForFullPrompt(history = [], maxChars = 1800) {
  const rows = (Array.isArray(history) ? history : [])
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
    .slice(-8)
    .map((item) => `${item.role === 'assistant' ? 'DRAK-GPT' : 'User'}: ${clampText(item.content || '', 500)}`);

  const picked = [];
  let used = 0;
  for (const row of [...rows].reverse()) {
    if (used + row.length + 1 > maxChars) break;
    picked.unshift(row);
    used += row.length + 1;
  }
  return picked.join('\n');
}

function getModeInstruction(model, intent, compact = false) {
  if (compact) {
    if (intent === 'coding' || intent === 'error_debugging' || model === 'coding') return 'Mode Coding: analisis singkat, beri kode lengkap kalau diminta, code block rapi, cara run singkat, jangan hardcode secret.';
    if (intent === 'prompt_making') return 'Mode Prompt: buat prompt rapi, terkunci, detail, dan anti-halusinasi.';
    if (intent === 'long_text_analysis') return 'Mode Text Panjang: rangkum/analisis isi text, jangan jawab data kurang.';
    if (intent === 'math') return 'Mode Math: hitung bertahap, jangan asal jawab kalau data kurang.';
    if (intent === 'muslim') return 'Mode Muslim: hati-hati, jangan mengarang dalil.';
    if (model === 'pro') return 'Mode Pro: jawaban matang, relevan, tetap hemat kata.';
    if (model === 'thinking' || intent === 'thinking') return 'Mode Thinking: runtut, sebutkan kemungkinan paling masuk akal.';
    return 'Mode Instant: cepat, ringkas, langsung ke inti.';
  }
  const base = MODEL_INSTRUCTIONS[model] || MODEL_INSTRUCTIONS.instant;
  if ((intent === 'coding' || intent === 'error_debugging') && model !== 'coding') return `${base}\n\n[MODE AUTO: CODING]\n${MODEL_INSTRUCTIONS.coding}`;
  if (intent === 'prompt_making') return `${base}\n\n[MODE AUTO: PROMPT]\nBuat prompt rapi, lengkap, ada lock/aturan, dan jangan liar.`;
  if (intent === 'long_text_analysis') return `${base}\n\n[MODE AUTO: TEXT PANJANG]\nUser memberi text panjang. Analisis/rangkum bagian penting dan jawab instruksi user. Jangan jawab data kurang.`;
  if (intent === 'math') return `${base}\n\n[MODE AUTO: MATH]\nJawab perhitungan dengan langkah jelas. Jangan sok yakin kalau datanya kurang.`;
  if (intent === 'muslim') return `${base}\n\n[MODE AUTO: MUSLIM]\nJawab hati-hati. Kalau perkara agama butuh rujukan kuat dan kamu tidak yakin, bilang belum bisa pastiin.`;
  if (intent === 'image_or_visual') return `${base}\n\n[MODE AUTO: VISUAL]\nKalau provider visual tidak mengembalikan URL/media valid, jangan klaim gambar/video berhasil dibuat.`;
  if (intent === 'music_or_audio') return `${base}\n\n[MODE AUTO: AUDIO]\nKalau provider audio tidak mengembalikan URL/media valid, jangan klaim lagu berhasil dibuat.`;
  return base;
}

function trimForGetPrompt(text, maxLength = GET_PROMPT_LIMIT) {
  const clean = sanitizeMessage(text);
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}\n...[prompt dipotong biar API GET gak ngambek]` : clean;
}

function extractImportantLines(text = '', maxChars = 620) {
  const keywords = /(error|failed|gagal|todo|target|masalah|fix|perbaiki|request|instruksi|wajib|lock|hasil|expected|actual|build|deploy|api|kode|script|prompt)/i;
  const lines = sanitizeMessage(text).split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const picked = [];
  for (const line of lines) {
    if (keywords.test(line)) picked.push(line.slice(0, 220));
    if (picked.join('\n').length >= maxChars) break;
  }
  return picked.join('\n').slice(0, maxChars);
}

function prepareLongTextPrompt(message = '', maxChars = 1200) {
  const clean = sanitizeMessage(message).replace(/[ \t]+/g, ' ');
  const threshold = APP_CONFIG.limits.longTextThreshold || 2500;
  if (clean.length <= threshold) return clampText(clean, maxChars);

  const head = clean.slice(0, Math.floor(maxChars * 0.46));
  const tail = clean.slice(-Math.floor(maxChars * 0.32));
  const important = extractImportantLines(clean, Math.floor(maxChars * 0.22));
  return [
    'User mengirim text panjang. Tugas kamu: analisis inti text ini dan jawab sesuai permintaan user. Jangan bilang data kurang hanya karena text panjang.',
    '[AWAL TEXT]',
    head,
    important ? '[BAGIAN PENTING TERDETEKSI]\n' + important : '',
    '[AKHIR TEXT]',
    tail
  ].filter(Boolean).join('\n');
}

function buildCompactPrompt({ history, userMessage, model, intent, attachments, forceIndonesian = false }) {
  const languageRule = isIndonesianInput(userMessage) || forceIndonesian
    ? 'Jawab WAJIB bahasa Indonesia gaul/tongkrongan. Jangan Inggris kecuali user minta. Istilah coding tetap original.'
    : 'Jawab pakai bahasa yang sama dengan user.';

  const codingRule = (intent === 'coding' || intent === 'error_debugging')
    ? 'Kalau user minta coding/script/kode lengkap, beri solusi lengkap yang bisa dicoba, bukan contoh print receh. Pakai markdown code block.'
    : '';

  const sections = [
    '[ATURAN]',
    'Kamu DRAK-GPT by Dev ALIZZ. Gaya santai, tegas, ceplas-ceplos tipis tapi sopan. Jangan ngarang. Jangan sering bilang data kurang; kalau kurang, sebutkan detail spesifik yang kurang.',
    languageRule,
    getModeInstruction(model, intent, true),
    codingRule,
    attachmentSummary(attachments) ? `[LAMPIRAN]\n${attachmentSummary(attachments)}\nJangan klaim bisa melihat isi gambar kalau vision belum aktif.` : '',
    trimHistoryForCompactPrompt(history) ? `[KONTEKS SINGKAT]\n${trimHistoryForCompactPrompt(history)}` : '',
    '[PESAN]',
    prepareLongTextPrompt(userMessage, intent === 'coding' || intent === 'error_debugging' ? 1500 : 1200)
  ].filter(Boolean).join('\n');

  return trimForGetPrompt(sections, intent === 'coding' ? 2500 : GET_PROMPT_LIMIT);
}

function buildFullPrompt({ history, userMessage, model, intent, attachments, forceIndonesian = false }) {
  const languageRule = isIndonesianInput(userMessage) || forceIndonesian
    ? 'Jawab menggunakan bahasa Indonesia gaul/tongkrongan. Jangan membalas bahasa Inggris kecuali user minta. Istilah coding boleh tetap English, penjelasan tetap Indonesia.'
    : 'Jawab menggunakan bahasa yang sama dengan user.';

  const sections = [
    '[IDENTITAS AI]',
    DRAK_SYSTEM_PROMPT,
    '[MODE AKTIF]',
    getModeInstruction(model, intent, false),
    '[BAHASA WAJIB]',
    languageRule,
    '[ANTI HALUSINASI]',
    'Jangan mengarang. Jangan jadikan data kurang sebagai jawaban default. Kalau benar-benar kurang, sebutkan bagian spesifik yang kurang dan tetap bantu dengan asumsi aman. Kalau tidak tahu, bilang jujur. Jawab sesuai konteks chat.',
    attachmentSummary(attachments) ? `[LAMPIRAN]\n${attachmentSummary(attachments)}` : '',
    trimHistoryForFullPrompt(history) ? `[KONTEKS CHAT TERAKHIR]\n${trimHistoryForFullPrompt(history)}` : '',
    '[PESAN USER]',
    prepareLongTextPrompt(userMessage, Math.min(MAX_MESSAGE_LENGTH, 4200)),
    '[ARAHAN OUTPUT]',
    'Balas sebagai DRAK-GPT. Gaya tajam, santai, berguna, dan jangan ngawur.'
  ].filter(Boolean).join('\n\n');

  return sections.length > FULL_PROMPT_LIMIT ? `${sections.slice(0, FULL_PROMPT_LIMIT)}\n...[prompt dipotong otomatis]` : sections;
}

function cleanReply(rawReply) {
  let reply = sanitizeMessage(rawReply)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  const formalStarts = [
    /^Baik, saya akan membantu Anda dengan senang hati[,.!]?\s*/i,
    /^Sebagai (sebuah )?(model )?AI[^,.]*[,.]?\s*/i,
    /^As an? AI language model[^,.]*[,.]?\s*/i,
    /^Mohon maaf sebesar-besarnya[,.]?\s*/i,
    /^I'?m sorry[,.]?\s*/i
  ];
  for (const pattern of formalStarts) reply = reply.replace(pattern, '');

  if (isLowValueDataKurang(reply)) return '';
  reply = reply.replace(/^maaf[,\s]+data (lu |kamu |anda )?kurang[.!?]*/i, 'Detailnya masih kurang, Bos.');
  if (isBadReply(reply)) return '';
  return reply.trim();
}

function buildProviderUrl(provider, finalPrompt) {
  const url = new URL(provider.url);
  const params = new URLSearchParams(url.search);
  params.set(provider.param || 'text', finalPrompt);
  if (provider.extraParams && typeof provider.extraParams === 'object') {
    for (const [key, value] of Object.entries(provider.extraParams)) {
      params.set(key, String(value));
    }
  }
  url.search = params.toString();
  return url.toString();
}

async function callProvider(provider, prompts, timeoutMs) {
  if (!provider || provider.enabled === false) throw new Error('Provider belum aktif');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const method = (provider.method || 'GET').toUpperCase();
    const finalPrompt = method === 'GET' ? prompts.compact : prompts.full;
    const fetchOptions = {
      method,
      signal: controller.signal,
      headers: { Accept: 'application/json, text/plain;q=0.9' }
    };

    let url = provider.url;
    if (method === 'POST') {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify({ message: finalPrompt, text: finalPrompt, prompt: finalPrompt });
    } else {
      url = buildProviderUrl(provider, finalPrompt);
      if (url.length > 3900) throw new Error('URL GET terlalu panjang');
    }

    logInfo('try provider', provider.id, method, `prompt=${finalPrompt.length}`);
    const response = await fetch(url, fetchOptions);
    const raw = await response.text();
    if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
    if (isBadReply(raw)) throw new Error('Provider raw reply invalid');

    const payload = parseJsonSafe(raw);
    const parsed = parsePayload(provider, payload);
    const reply = cleanReply(parsed.reply);
    if (isBadReply(reply)) throw new Error('Provider reply kosong/invalid');

    logInfo('provider ok', provider.id);
    return {
      ...parsed,
      reply,
      responseTime: parsed.responseTime || `${Date.now() - started}ms`
    };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`Provider timeout > ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}


function isSimpleGreeting(message = '') {
  const text = sanitizeMessage(message).toLowerCase();
  return /^(hai|halo|hallo|hello|hi|yo|p|assalamualaikum|salam)(\s+(bang|bos|bro|gan|min|dev))?[!?.\s]*$/i.test(text) || /^(bang|bos|bro|gan)[!?.\s]*$/i.test(text);
}

function greetingReply() {
  return 'Yo Bos, DRAK-GPT aktif. Mau dibantu ngapain? Chat biasa, coding, ide, atau bedah error juga gas.';
}

function ownerHelpLine() {
  const owner = APP_CONFIG.owner || {};
  const wa = owner.whatsappUrl || (owner.whatsapp ? `https://wa.me/${String(owner.whatsapp).replace(/\D/g, '')}` : '');
  const tg = owner.telegramUrl || (owner.telegram ? `https://t.me/${String(owner.telegram).replace('@', '')}` : '');
  return `Kalau error terus, chat ${owner.name || 'owner'}${wa ? `: ${wa}` : ''}${tg ? ` atau ${tg}` : ''}`;
}

function errorFallbackForIntent(intent) {
  if (intent === 'image_or_visual') return `Provider visual lagi gak bisa dipakai, Bos. Prompt lu udah gue siapin, coba ulangi bentar lagi.

${ownerHelpLine()}`;
  if (intent === 'music_or_audio') return `Provider audio lagi pada ngambek, Bos. Coba ulangi sebentar lagi.

${ownerHelpLine()}`;
  return `Provider AI lagi ngambek, Bos. Gue udah coba fallback, tapi belum dapet jawaban bersih. Coba ulang bentar lagi.

${ownerHelpLine()}`;
}

function visionFallback() {
  return 'Gambarnya udah masuk, Bos. Tapi mata vision-nya belum dipasang, jadi gue belum bisa lihat isi gambar langsung. Kalau lu jelasin gambarnya sedikit, gue bantu bedah tanpa ngarang kayak dukun file.';
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 200, { success: true });
  if (req.method !== 'POST') return json(res, 405, { success: false, reply: 'Method tidak didukung.' });

  if (!checkRateLimit(req)) {
    return json(res, 429, { success: false, reply: 'Request terlalu cepat. Tunggu sebentar dulu biar server gak ngambek.' });
  }

  const body = typeof req.body === 'object' && req.body !== null ? req.body : await new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(parseJsonSafe(data)));
  });

  const attachments = normalizeAttachments(body?.attachments);
  const message = sanitizeMessage(body?.message);
  const requestedModel = sanitizeMessage(body?.model || 'instant');
  const model = MODEL_CHAINS[requestedModel] ? requestedModel : 'instant';
  const chatId = sanitizeMessage(body?.chatId || '');
  const history = Array.isArray(body?.history) ? body.history : [];
  const intent = detectIntent(message, attachments);
  const shouldUseIndonesian = isIndonesianInput(message);

  if (!message && !attachments.length) {
    return json(res, 400, { success: false, model, reply: 'Pesan masih kosong, Bos.' });
  }

  if (message.length > MAX_MESSAGE_LENGTH + 12_000) {
    return json(res, 413, { success: false, model, reply: 'Pesan terlalu panjang. Ringkas dulu biar DRAK-GPT bisa proses.' });
  }

  if (attachments.some((item) => item.size > MAX_ATTACHMENT_SIZE)) {
    return json(res, 413, { success: false, model, reply: 'File kegedean, Bos. Maksimal 2MB dulu biar server gak megap-megap.' });
  }

  if (intent === 'vision_image_question' && !APP_CONFIG.features.vision) {
    return json(res, 200, {
      success: true,
      model,
      intent,
      provider: 'vision-fallback',
      chatId,
      reply: visionFallback(),
      timestamp: new Date().toISOString()
    });
  }

  if (intent === 'general_chat' && !attachments.length && isSimpleGreeting(message)) {
    return json(res, 200, {
      success: true,
      model,
      intent,
      provider: 'local-greeting',
      chatId,
      reply: greetingReply(),
      responseTime: '0ms',
      timestamp: new Date().toISOString()
    });
  }

  const chain = getProviderChain(model, intent);
  const timeoutMs = getTimeoutForModel(model, intent);
  const errors = [];

  for (const providerId of chain) {
    const provider = PROVIDERS[providerId];
    if (!provider) continue;

    const prompts = {
      compact: buildCompactPrompt({ history, userMessage: message, model, intent, attachments }),
      full: buildFullPrompt({ history, userMessage: message, model, intent, attachments })
    };

    try {
      let result = await callProvider(provider, prompts, timeoutMs);

      if (shouldUseIndonesian && looksMostlyEnglish(result.reply)) {
        try {
          const retryPrompts = {
            compact: buildCompactPrompt({
              history,
              userMessage: `${message}\n\n[ULANGI JAWABAN]\nJawaban sebelumnya salah bahasa. Ulangi dalam bahasa Indonesia gaul/tongkrongan. Jangan translate kode, command, nama function, atau error asli.`,
              model,
              intent,
              attachments,
              forceIndonesian: true
            }),
            full: buildFullPrompt({
              history,
              userMessage: `${message}\n\n[ULANGI JAWABAN]\nJawaban sebelumnya salah bahasa. Ulangi dalam bahasa Indonesia gaul/tongkrongan. Jangan translate kode, command, nama function, atau error asli.`,
              model,
              intent,
              attachments,
              forceIndonesian: true
            })
          };
          const retryResult = await callProvider(provider, retryPrompts, Math.min(6000, timeoutMs));
          if (retryResult?.reply && !looksMostlyEnglish(retryResult.reply)) result = retryResult;
        } catch (retryError) {
          errors.push({ provider: providerId, message: `language retry: ${retryError.message}` });
          logWarn('language retry failed', providerId, retryError.message);
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
      logWarn('provider failed', providerId, error.message);
    }
  }

  return json(res, 200, {
    success: false,
    model,
    intent,
    provider: null,
    chatId,
    reply: errorFallbackForIntent(intent),
    timestamp: new Date().toISOString(),
    fallbackTried: errors.map((item) => item.provider)
  });
}
