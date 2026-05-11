import crypto from 'node:crypto';

const isProd = process.env.NODE_ENV === 'production';
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 10;
const rateStore = globalThis.__DRAK_ACCESS_RATE_STORE__ || new Map();
globalThis.__DRAK_ACCESS_RATE_STORE__ = rateStore;

const ACCESS_ENABLED = process.env.DRAK_ACCESS_ENABLED !== 'false';
const ACCESS_KEY = String(process.env.DRAK_ACCESS_KEY || process.env.DRAK_LOGIN_KEY || process.env.ACCESS_KEY || '').trim();
const ACCESS_PASSWORD = String(process.env.DRAK_ACCESS_PASSWORD || process.env.DRAK_LOGIN_PASSWORD || process.env.ACCESS_PASSWORD || '').trim();
const ACCESS_TOKEN_SECRET = String(process.env.DRAK_ACCESS_TOKEN_SECRET || `${ACCESS_KEY}:${ACCESS_PASSWORD}:${process.env.VERCEL_GIT_COMMIT_SHA || 'drak-gpt'}`).trim();
const TOKEN_TTL_HOURS = Number(process.env.DRAK_ACCESS_TOKEN_TTL_HOURS || 720);
const TOKEN_TTL_MS = Math.max(1, TOKEN_TTL_HOURS) * 60 * 60 * 1000;

function logWarn(...args) {
  if (!isProd) console.warn('[DRAK-GPT access]', ...args);
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

function parseJsonSafe(text) {
  try {
    return JSON.parse(String(text || '{}'));
  } catch {
    return {};
  }
}

async function readBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;

  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(parseJsonSafe(data)));
  });
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function base64UrlJson(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function signAccessPayload(payloadEncoded) {
  return crypto.createHmac('sha256', ACCESS_TOKEN_SECRET).update(payloadEncoded).digest('base64url');
}

function createAccessToken() {
  const now = Date.now();
  const payload = base64UrlJson({
    app: 'drak-gpt',
    iat: now,
    exp: now + TOKEN_TTL_MS
  });

  return `${payload}.${signAccessPayload(payload)}`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 200, { success: true });
  if (req.method !== 'POST') return json(res, 405, { success: false, message: 'Method tidak didukung.' });

  if (!ACCESS_ENABLED) {
    return json(res, 200, { success: true, token: 'access-disabled', expiresInHours: TOKEN_TTL_HOURS });
  }

  if (!ACCESS_KEY || !ACCESS_PASSWORD) {
    return json(res, 500, {
      success: false,
      message: 'Access gate belum diset. Tambahkan DRAK_ACCESS_KEY dan DRAK_ACCESS_PASSWORD di Vercel Environment Variables.'
    });
  }

  if (!checkRateLimit(req)) {
    return json(res, 429, { success: false, message: 'Terlalu banyak percobaan login. Tunggu sebentar dulu.' });
  }

  try {
    const body = await readBody(req);
    const inputKey = String(body?.key || '').trim();
    const inputPassword = String(body?.password || '').trim();
    const valid = safeEqual(inputKey, ACCESS_KEY) && safeEqual(inputPassword, ACCESS_PASSWORD);

    if (!valid) {
      return json(res, 401, { success: false, message: 'Key atau password salah.' });
    }

    return json(res, 200, {
      success: true,
      token: createAccessToken(),
      expiresInHours: TOKEN_TTL_HOURS
    });
  } catch (error) {
    logWarn('login failed', error?.message || error);
    return json(res, 500, { success: false, message: 'Login access gate error. Coba ulangi.' });
  }
}
