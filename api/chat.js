import { eq } from 'drizzle-orm';
import { APP_CONFIG } from '../config.js';
import { requireUser, userPlanStatus } from '../lib/auth.js';
import { requireDb, schema } from '../lib/db/index.js';
import { callAiWithFallback, getMode } from '../lib/provider.js';
import { checkRateLimit, cleanString, getIp, json, methodNotAllowed, readBody } from '../lib/http.js';

const jakartaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

function dayKey(date = new Date()) {
  return jakartaDate.format(new Date(date));
}

function publicChatError(message) {
  return cleanString(message, 240) || 'Provider AI belum bisa jawab. Coba ulangi sebentar lagi.';
}

async function resetDailyIfNeeded(user) {
  const { db } = requireDb();
  const last = user.lastDailyReset || user.last_daily_reset || new Date(0);
  if (dayKey(last) === dayKey()) return user;
  const rows = await db.update(schema.users).set({
    dailyUsed: 0,
    lastDailyReset: new Date(),
    updatedAt: new Date()
  }).where(eq(schema.users.id, user.id)).returning();
  return rows[0] || { ...user, dailyUsed: 0, lastDailyReset: new Date() };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 200, { success: true });
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const auth = await requireUser(req);
    if (!auth.ok) return json(res, auth.status, { success: false, code: 'AUTH_DENIED', reply: auth.message });

    const limited = checkRateLimit('chat', `${auth.user.id}:${getIp(req)}`, APP_CONFIG.limits.defaultRateLimitPerMinute || 20, 60_000);
    if (!limited.ok) return json(res, 429, { success: false, reply: 'Request terlalu cepat. Tunggu sebentar dulu.' });

    const { db, sql } = requireDb();
    let user = await resetDailyIfNeeded(auth.user);
    const accountStatus = userPlanStatus(user);
    if (accountStatus === 'expired') return json(res, 403, { success: false, code: 'EXPIRED', reply: 'Masa aktif akun sudah habis. Hubungi admin untuk perpanjang.' });
    if (accountStatus === 'suspended') return json(res, 403, { success: false, code: 'SUSPENDED', reply: 'Akun disuspend. Hubungi admin.' });

    const plan = user.planId ? (await db.select().from(schema.plans).where(eq(schema.plans.id, user.planId)).limit(1))[0] : null;
    const dailyLimit = plan?.dailyLimit || APP_CONFIG.limits.defaultDailyLimit || 100;
    if ((user.dailyUsed || 0) >= dailyLimit) {
      return json(res, 429, { success: false, code: 'LIMIT_REACHED', reply: 'Limit harian habis. Coba lagi besok atau hubungi admin untuk upgrade paket.' });
    }

    const body = await readBody(req);
    const message = cleanString(body.message, APP_CONFIG.ai.maxMessageLength || 12000);
    const mode = getMode(cleanString(body.mode || body.model || APP_CONFIG.ai.defaultMode, 40));
    const chatId = cleanString(body.chatId, 120);
    const history = Array.isArray(body.history) ? body.history : [];
    if (!message) return json(res, 400, { success: false, reply: 'Pesan masih kosong.' });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), APP_CONFIG.ai.providerTimeoutMs || 25000);
    const started = Date.now();

    try {
      const result = await callAiWithFallback({ message, history, mode, signal: controller.signal });

      await db.insert(schema.chatLogs).values({
        userId: user.id,
        message,
        reply: result.reply,
        mode,
        provider: result.provider,
        apiKeyId: result.apiKeyId || null
      });
      await db.insert(schema.usageLogs).values({
        userId: user.id,
        apiKeyId: result.apiKeyId || null,
        type: 'chat',
        count: 1
      });
      await sql`update users set daily_used = daily_used + 1, updated_at = now() where id = ${user.id}`;

      return json(res, 200, {
        success: true,
        mode,
        model: mode,
        chatId,
        provider: result.provider,
        providerLabel: result.apiKeyLabel || 'AI Provider',
        reply: result.reply,
        limit: {
          dailyLimit,
          dailyUsed: (user.dailyUsed || 0) + 1,
          remaining: Math.max(0, dailyLimit - ((user.dailyUsed || 0) + 1))
        },
        responseTime: `${Date.now() - started}ms`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const messageError = error?.name === 'AbortError'
        ? `Provider timeout > ${APP_CONFIG.ai.providerTimeoutMs || 25000}ms`
        : error?.message || 'Provider error';
      return json(res, 200, {
        success: false,
        mode,
        model: mode,
        provider: 'fallback',
        chatId,
        reply: `Provider AI belum bisa jawab. ${publicChatError(messageError)}`,
        timestamp: new Date().toISOString()
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return json(res, 500, { success: false, reply: 'Server chat error. Cek env/database atau hubungi admin.' });
  }
}
