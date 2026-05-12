const jsonHeader = 'application/json; charset=utf-8';

export function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', jsonHeader);
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export function methodNotAllowed(res) {
  return json(res, 405, { success: false, message: 'Method tidak didukung.' });
}

export function parseJsonSafe(text, fallback = {}) {
  try {
    return JSON.parse(String(text || '{}')) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function readBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(parseJsonSafe(data, {})));
  });
}

export function getIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return (Array.isArray(forwarded) ? forwarded[0] : String(forwarded || req.socket?.remoteAddress || 'unknown'))
    .split(',')[0]
    .trim();
}

export function getUserAgent(req) {
  const value = req.headers['user-agent'];
  return Array.isArray(value) ? value[0] || '' : String(value || '');
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    String(header)
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        const key = decodeURIComponent(index >= 0 ? part.slice(0, index) : part);
        const value = decodeURIComponent(index >= 0 ? part.slice(index + 1) : '');
        return [key, value];
      })
  );
}

export function setCookie(res, name, value, options = {}) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || '/'}`);
  parts.push(`Max-Age=${Math.max(0, Number(options.maxAge || 0))}`);
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  parts.push('HttpOnly');
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  const current = res.getHeader('Set-Cookie');
  const next = Array.isArray(current) ? current : current ? [String(current)] : [];
  next.push(parts.join('; '));
  res.setHeader('Set-Cookie', next);
}

export function clearCookie(res, name) {
  setCookie(res, name, '', { maxAge: 0 });
}

const stores = globalThis.__DRAK_RATE_LIMIT_STORES__ || new Map();
globalThis.__DRAK_RATE_LIMIT_STORES__ = stores;

export function checkRateLimit(bucket, key, limit, windowMs = 60_000) {
  const store = stores.get(bucket) || new Map();
  stores.set(bucket, store);
  const now = Date.now();
  const record = store.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }
  record.count += 1;
  store.set(key, record);
  for (const [itemKey, item] of store.entries()) {
    if (now > item.resetAt + windowMs) store.delete(itemKey);
  }
  return { ok: record.count <= limit, remaining: Math.max(0, limit - record.count), resetAt: record.resetAt };
}

export function cleanString(value, max = 2000) {
  return String(value || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}
