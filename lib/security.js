import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const SESSION_SECRET = process.env.SESSION_SECRET || '';
const ENC_SECRET = process.env.API_KEY_ENCRYPTION_SECRET || '';

export function requireSessionSecret() {
  if (!SESSION_SECRET || SESSION_SECRET.length < 24) {
    throw new Error('SESSION_SECRET wajib diisi minimal 24 karakter.');
  }
}

export function hashToken(token) {
  requireSessionSecret();
  return crypto.createHmac('sha256', SESSION_SECRET).update(String(token || '')).digest('hex');
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export async function hashPassword(password) {
  const clean = String(password || '');
  if (clean.length < 8) throw new Error('Password minimal 8 karakter.');
  return bcrypt.hash(clean, 12);
}

export async function verifyPassword(password, passwordHash) {
  if (!password || !passwordHash) return false;
  return bcrypt.compare(String(password), String(passwordHash));
}

function encryptionKey() {
  if (!ENC_SECRET || ENC_SECRET.length < 24) {
    throw new Error('API_KEY_ENCRYPTION_SECRET wajib diisi minimal 24 karakter.');
  }
  return crypto.createHash('sha256').update(ENC_SECRET).digest();
}

export function encryptSecret(value) {
  const text = String(value || '').trim();
  if (!text) throw new Error('Secret/API key kosong.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(payload) {
  const [version, ivEncoded, tagEncoded, encryptedEncoded] = String(payload || '').split('.');
  if (version !== 'v1' || !ivEncoded || !tagEncoded || !encryptedEncoded) throw new Error('Format encrypted key tidak valid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivEncoded, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}

export function maskSecret(secret) {
  const value = String(secret || '');
  if (!value) return '';
  if (value.length <= 8) return `${value.slice(0, 2)}****${value.slice(-2)}`;
  return `${value.slice(0, 9)}********${value.slice(-4)}`;
}

export function safeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    planId: user.planId || user.plan_id || null,
    expiredAt: user.expiredAt || user.expired_at || null,
    deviceId: user.deviceId || user.device_id || null,
    deviceName: user.deviceName || user.device_name || null,
    dailyUsed: Number(user.dailyUsed ?? user.daily_used ?? 0),
    lastDailyReset: user.lastDailyReset || user.last_daily_reset || null,
    lastLoginAt: user.lastLoginAt || user.last_login_at || null,
    createdAt: user.createdAt || user.created_at || null
  };
}

export function publicApiKey(row) {
  return {
    id: row.id,
    label: row.label,
    provider: row.provider,
    apiUrl: row.apiUrl ?? row.api_url,
    status: row.status,
    priority: row.priority,
    dailyUsed: Number(row.dailyUsed ?? row.daily_used ?? 0),
    totalUsed: Number(row.totalUsed ?? row.total_used ?? 0),
    maskedKey: row.maskedKey || 'encrypted********key',
    lastError: row.lastError ?? row.last_error ?? null,
    lastUsedAt: row.lastUsedAt ?? row.last_used_at ?? null,
    createdAt: row.createdAt ?? row.created_at ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null
  };
}
