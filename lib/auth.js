import { eq, and, isNull, gt } from 'drizzle-orm';
import { requireDb, schema } from './db/index.js';
import { clearCookie, getIp, getUserAgent, parseCookies, setCookie } from './http.js';
import { hashToken, randomToken, safeUser } from './security.js';

export const USER_COOKIE = 'drak_user_session';
export const ADMIN_COOKIE = 'drak_admin_session';
const USER_SESSION_DAYS = 30;
const ADMIN_SESSION_HOURS = 12;

export function cookieNameForType(type = 'user') {
  return type === 'admin' ? ADMIN_COOKIE : USER_COOKIE;
}

export function sessionMaxAge(type = 'user') {
  return type === 'admin' ? ADMIN_SESSION_HOURS * 60 * 60 : USER_SESSION_DAYS * 24 * 60 * 60;
}

export async function createSession({ res, req, user, deviceId = '', type = 'user' }) {
  const { db } = requireDb();
  const token = randomToken(36);
  const tokenHash = hashToken(token);
  const maxAge = sessionMaxAge(type);
  const expiresAt = new Date(Date.now() + maxAge * 1000);

  await db.insert(schema.sessions).values({
    userId: user.id,
    sessionTokenHash: tokenHash,
    sessionType: type,
    deviceId: deviceId || null,
    ipAddress: getIp(req),
    userAgent: getUserAgent(req).slice(0, 500),
    expiresAt
  });

  setCookie(res, cookieNameForType(type), token, { maxAge, sameSite: 'Lax' });
  return { token, expiresAt };
}

export async function revokeSession(req, res, type = 'user') {
  const { db } = requireDb();
  const token = parseCookies(req)[cookieNameForType(type)];
  if (token) {
    await db.update(schema.sessions)
      .set({ revokedAt: new Date() })
      .where(eq(schema.sessions.sessionTokenHash, hashToken(token)));
  }
  clearCookie(res, cookieNameForType(type));
}

export async function getSessionUser(req, type = 'user') {
  const { db } = requireDb();
  const token = parseCookies(req)[cookieNameForType(type)];
  if (!token) return null;
  const now = new Date();
  const rows = await db.select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(
      eq(schema.sessions.sessionTokenHash, hashToken(token)),
      eq(schema.sessions.sessionType, type),
      isNull(schema.sessions.revokedAt),
      gt(schema.sessions.expiresAt, now)
    ))
    .limit(1);

  const found = rows[0];
  if (!found) return null;
  return { user: found.user, session: found.session, safe: safeUser(found.user) };
}

export async function requireUser(req) {
  const session = await getSessionUser(req, 'user');
  if (!session) return { ok: false, status: 401, message: 'Silakan login dulu.' };
  if (session.user.role !== 'user') return { ok: false, status: 403, message: 'Akun ini bukan akun user chat.' };
  if (session.user.status === 'suspended') return { ok: false, status: 403, message: 'Akun disuspend. Hubungi admin.' };
  if (session.user.status === 'deleted') return { ok: false, status: 403, message: 'Akun tidak aktif.' };
  return { ok: true, ...session };
}

export async function requireAdmin(req) {
  const session = await getSessionUser(req, 'admin');
  if (!session) return { ok: false, status: 401, message: 'Silakan login admin dulu.' };
  if (!['admin', 'super_admin'].includes(session.user.role)) return { ok: false, status: 403, message: 'Akses admin ditolak.' };
  if (session.user.status !== 'active') return { ok: false, status: 403, message: 'Admin tidak aktif.' };
  return { ok: true, ...session };
}

export function userPlanStatus(user) {
  if (user.status === 'suspended') return 'suspended';
  if (user.status !== 'active') return user.status;
  if (user.expiredAt && new Date(user.expiredAt).getTime() < Date.now()) return 'expired';
  return 'active';
}
