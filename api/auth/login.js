import { eq } from 'drizzle-orm';
import { APP_CONFIG } from '../../config.js';
import { requireDb, schema } from '../../lib/db/index.js';
import { createSession } from '../../lib/auth.js';
import { checkRateLimit, cleanString, getIp, getUserAgent, json, methodNotAllowed, readBody } from '../../lib/http.js';
import { safeUser, verifyPassword } from '../../lib/security.js';

async function logLogin({ user, username, success, reason, req }) {
  const { db } = requireDb();
  await db.insert(schema.loginLogs).values({
    userId: user?.id || null,
    username: cleanString(username, 80),
    role: user?.role || 'user',
    status: user?.status || null,
    ipAddress: getIp(req),
    userAgent: getUserAgent(req).slice(0, 500),
    success,
    reason
  }).catch(() => null);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 200, { success: true });
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const ip = getIp(req);
    const limited = checkRateLimit('user-login', ip, 10, 60_000);
    if (!limited.ok) return json(res, 429, { success: false, message: 'Terlalu banyak percobaan login. Tunggu sebentar dulu.' });

    const body = await readBody(req);
    const username = cleanString(body.username, 80).toLowerCase();
    const password = String(body.password || '');
    const deviceId = cleanString(body.deviceId, 200);
    const deviceName = cleanString(body.deviceName, 200) || 'Browser';

    if (!username || !password) return json(res, 400, { success: false, message: 'Username dan password wajib diisi.' });
    if (APP_CONFIG.security.oneAccountOneDevice && !deviceId) {
      return json(res, 400, { success: false, message: 'Device ID tidak terbaca. Refresh browser lalu login ulang.' });
    }

    const { db } = requireDb();
    const users = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    const user = users[0];
    const valid = user && user.role === 'user' && await verifyPassword(password, user.passwordHash);

    if (!valid) {
      await logLogin({ user, username, success: false, reason: 'invalid_credentials', req });
      return json(res, 401, { success: false, message: 'Username atau password salah.' });
    }

    if (user.status === 'deleted') {
      await logLogin({ user, username, success: false, reason: 'deleted', req });
      return json(res, 403, { success: false, message: 'Akun tidak aktif.' });
    }

    if (APP_CONFIG.security.oneAccountOneDevice && user.deviceId && user.deviceId !== deviceId) {
      await logLogin({ user, username, success: false, reason: 'device_locked', req });
      return json(res, 403, {
        success: false,
        code: 'DEVICE_LOCKED',
        message: 'Akun ini sudah aktif di perangkat lain. Hubungi admin untuk reset device.'
      });
    }

    const update = {
      lastIp: ip,
      lastUserAgent: getUserAgent(req).slice(0, 500),
      lastLoginAt: new Date(),
      updatedAt: new Date()
    };
    if (!user.deviceId && deviceId) {
      update.deviceId = deviceId;
      update.deviceName = deviceName;
    }
    await db.update(schema.users).set(update).where(eq(schema.users.id, user.id));
    const refreshed = { ...user, ...update };

    await createSession({ res, req, user: refreshed, deviceId, type: 'user' });
    await logLogin({ user: refreshed, username, success: true, reason: 'ok', req });

    return json(res, 200, { success: true, user: safeUser(refreshed) });
  } catch (error) {
    return json(res, 500, { success: false, message: error?.message || 'Login error.' });
  }
}
