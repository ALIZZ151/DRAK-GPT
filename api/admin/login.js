import { eq } from 'drizzle-orm';
import { requireDb, schema } from '../../lib/db/index.js';
import { createSession } from '../../lib/auth.js';
import { checkRateLimit, cleanString, getIp, getUserAgent, json, methodNotAllowed, readBody } from '../../lib/http.js';
import { safeUser, verifyPassword } from '../../lib/security.js';

async function logLogin({ user, username, success, reason, req }) {
  const { db } = requireDb();
  await db.insert(schema.loginLogs).values({
    userId: user?.id || null,
    username: cleanString(username, 80),
    role: user?.role || 'admin',
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
    const limited = checkRateLimit('admin-login', getIp(req), 8, 60_000);
    if (!limited.ok) return json(res, 429, { success: false, message: 'Terlalu banyak percobaan login admin.' });

    const body = await readBody(req);
    const username = cleanString(body.username, 80).toLowerCase();
    const password = String(body.password || '');
    if (!username || !password) return json(res, 400, { success: false, message: 'Username dan password wajib diisi.' });

    const { db } = requireDb();
    const user = (await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1))[0];
    const valid = user && ['admin', 'super_admin'].includes(user.role) && user.status === 'active' && await verifyPassword(password, user.passwordHash);

    if (!valid) {
      await logLogin({ user, username, success: false, reason: 'invalid_admin_login', req });
      return json(res, 401, { success: false, message: 'Login admin gagal.' });
    }

    await db.update(schema.users).set({
      lastIp: getIp(req),
      lastUserAgent: getUserAgent(req).slice(0, 500),
      lastLoginAt: new Date(),
      updatedAt: new Date()
    }).where(eq(schema.users.id, user.id));

    await createSession({ res, req, user, type: 'admin' });
    await logLogin({ user, username, success: true, reason: 'ok', req });
    return json(res, 200, { success: true, admin: safeUser(user) });
  } catch (error) {
    return json(res, 500, { success: false, message: error?.message || 'Admin login error.' });
  }
}
