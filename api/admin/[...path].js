import { and, eq, ne } from 'drizzle-orm';
import { APP_CONFIG } from '../../config.js';
import { requireAdmin } from '../../lib/auth.js';
import { requireDb, schema } from '../../lib/db/index.js';
import { cleanString, getIp, json, methodNotAllowed, parseJsonSafe, readBody } from '../../lib/http.js';
import { decryptSecret, encryptSecret, hashPassword, maskSecret, publicApiKey, safeUser } from '../../lib/security.js';

function getParts(req) {
  const raw = req.query?.path;
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') return raw.split('/').filter(Boolean);
  const path = new URL(req.url, 'http://localhost').pathname.replace(/^\/api\/admin\/?/, '');
  return path.split('/').filter(Boolean);
}

function getQuery(req) {
  return Object.fromEntries(new URL(req.url, 'http://localhost').searchParams.entries());
}

async function audit(adminId, req, action, targetType, targetId = '', metadata = {}) {
  const { db } = requireDb();
  await db.insert(schema.adminAuditLogs).values({
    adminId,
    action,
    targetType,
    targetId: String(targetId || ''),
    metadataJson: metadata,
    ipAddress: getIp(req)
  }).catch(() => null);
}

async function getTargetUser(id) {
  const { db } = requireDb();
  return (await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1))[0] || null;
}

function canTouchUser(admin, target, action = 'edit') {
  if (!target) return { ok: false, message: 'User tidak ditemukan.' };
  if (target.role === 'super_admin' && admin.role !== 'super_admin') {
    return { ok: false, message: 'Admin biasa tidak boleh mengubah super_admin.' };
  }
  if (action === 'delete' && target.id === admin.id) return { ok: false, message: 'Tidak bisa menghapus akun sendiri.' };
  return { ok: true };
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(days) {
  return new Date(Date.now() + Math.max(1, Number(days || 30)) * 24 * 60 * 60 * 1000);
}

async function listUsers(req, res) {
  const { sql } = requireDb();
  const rows = await sql`
    select u.id, u.username, u.role, u.status, u.expired_at, u.device_id, u.device_name,
           u.daily_used, u.last_daily_reset, u.last_login_at, u.created_at, u.updated_at,
           p.id as plan_id, p.name as plan_name, p.daily_limit as plan_daily_limit
    from users u
    left join plans p on p.id = u.plan_id
    order by u.created_at desc
    limit 300
  `;
  return json(res, 200, { success: true, users: rows });
}

async function createUser(req, res, admin) {
  const body = await readBody(req);
  const username = cleanString(body.username, 80).toLowerCase();
  const password = String(body.password || '');
  const role = ['user', 'admin', 'super_admin'].includes(body.role) ? body.role : 'user';
  const status = ['active', 'suspended', 'expired'].includes(body.status) ? body.status : 'active';
  const planId = cleanString(body.planId || body.plan_id, 80) || null;
  if (!username || !password) return json(res, 400, { success: false, message: 'Username dan password wajib diisi.' });
  if (role === 'super_admin' && admin.role !== 'super_admin') return json(res, 403, { success: false, message: 'Hanya super_admin yang bisa membuat super_admin.' });

  const { db } = requireDb();
  const plan = planId ? (await db.select().from(schema.plans).where(eq(schema.plans.id, planId)).limit(1))[0] : null;
  const activeDays = Number(body.activeDays || body.active_days || plan?.activeDays || 30);
  const expiredAt = parseDate(body.expiredAt || body.expired_at) || addDays(activeDays);
  const passwordHash = await hashPassword(password);
  const inserted = await db.insert(schema.users).values({
    username,
    passwordHash,
    role,
    status,
    planId,
    expiredAt,
    createdByAdminId: admin.id
  }).returning();
  await audit(admin.id, req, 'create_user', 'user', inserted[0].id, { username, role, status, planId });
  return json(res, 201, { success: true, user: safeUser(inserted[0]) });
}

async function patchUser(req, res, admin, userId) {
  const body = await readBody(req);
  const target = await getTargetUser(userId);
  const allowed = canTouchUser(admin, target);
  if (!allowed.ok) return json(res, 403, { success: false, message: allowed.message });

  const update = { updatedAt: new Date() };
  if (body.username !== undefined) update.username = cleanString(body.username, 80).toLowerCase();
  if (body.status !== undefined && ['active', 'suspended', 'expired'].includes(body.status)) update.status = body.status;
  if (body.role !== undefined) {
    if (admin.role !== 'super_admin') return json(res, 403, { success: false, message: 'Hanya super_admin yang boleh mengubah role.' });
    if (!['user', 'admin', 'super_admin'].includes(body.role)) return json(res, 400, { success: false, message: 'Role tidak valid.' });
    update.role = body.role;
  }
  if (body.planId !== undefined || body.plan_id !== undefined) update.planId = cleanString(body.planId || body.plan_id, 80) || null;
  if (body.expiredAt !== undefined || body.expired_at !== undefined) update.expiredAt = parseDate(body.expiredAt || body.expired_at);
  if (body.password) update.passwordHash = await hashPassword(body.password);

  const { db } = requireDb();
  const rows = await db.update(schema.users).set(update).where(eq(schema.users.id, userId)).returning();
  await audit(admin.id, req, 'update_user', 'user', userId, Object.keys(update));
  return json(res, 200, { success: true, user: safeUser(rows[0]) });
}

async function deleteUser(req, res, admin, userId) {
  const target = await getTargetUser(userId);
  const allowed = canTouchUser(admin, target, 'delete');
  if (!allowed.ok) return json(res, 403, { success: false, message: allowed.message });
  const { db } = requireDb();
  await db.delete(schema.users).where(eq(schema.users.id, userId));
  await audit(admin.id, req, 'delete_user', 'user', userId, { username: target.username });
  return json(res, 200, { success: true });
}

async function userAction(req, res, admin, userId, action) {
  const target = await getTargetUser(userId);
  const allowed = canTouchUser(admin, target);
  if (!allowed.ok) return json(res, 403, { success: false, message: allowed.message });
  const body = await readBody(req);
  const { db } = requireDb();
  let update = { updatedAt: new Date() };
  if (action === 'reset-device') update = { ...update, deviceId: null, deviceName: null };
  if (action === 'suspend') update = { ...update, status: 'suspended' };
  if (action === 'unsuspend') update = { ...update, status: 'active' };
  if (action === 'extend') {
    const base = target.expiredAt && new Date(target.expiredAt).getTime() > Date.now() ? new Date(target.expiredAt) : new Date();
    update.expiredAt = new Date(base.getTime() + Math.max(1, Number(body.days || 30)) * 24 * 60 * 60 * 1000);
    update.status = 'active';
  }
  const rows = await db.update(schema.users).set(update).where(eq(schema.users.id, userId)).returning();
  await audit(admin.id, req, action.replace('-', '_'), 'user', userId, update);
  return json(res, 200, { success: true, user: safeUser(rows[0]) });
}

async function stats(req, res) {
  const { sql } = requireDb();
  const [userStats] = await sql`
    select count(*)::int as total_user,
           count(*) filter (where status = 'active' and (expired_at is null or expired_at > now()))::int as user_aktif,
           count(*) filter (where status = 'suspended')::int as user_suspended,
           count(*) filter (where expired_at is not null and expired_at <= now())::int as user_expired
    from users
    where role = 'user'
  `;
  const [usageToday] = await sql`select coalesce(sum(count),0)::int as request_hari_ini from usage_logs where created_at >= current_date`;
  const [activeKeys] = await sql`select count(*)::int as api_key_aktif from api_keys where status = 'active'`;
  const [lastError] = await sql`select label, last_error from api_keys where last_error is not null order by updated_at desc limit 1`;
  return json(res, 200, {
    success: true,
    stats: {
      totalUser: userStats.total_user,
      userAktif: userStats.user_aktif,
      userExpired: userStats.user_expired,
      userSuspended: userStats.user_suspended,
      requestHariIni: usageToday.request_hari_ini,
      apiKeyAktif: activeKeys.api_key_aktif,
      errorApiTerakhir: lastError?.last_error ? `${lastError.label}: ${lastError.last_error}` : null
    }
  });
}

async function plans(req, res, admin, parts) {
  const { db } = requireDb();
  if (req.method === 'GET') {
    const rows = await db.select().from(schema.plans);
    return json(res, 200, { success: true, plans: rows });
  }
  const body = await readBody(req);
  if (req.method === 'POST') {
    const inserted = await db.insert(schema.plans).values({
      name: cleanString(body.name, 80),
      price: Number(body.price || 0),
      dailyLimit: Number(body.dailyLimit || body.daily_limit || APP_CONFIG.limits.defaultDailyLimit),
      maxDevices: Number(body.maxDevices || body.max_devices || 1),
      activeDays: Number(body.activeDays || body.active_days || 30),
      featuresJson: body.featuresJson || body.features_json || []
    }).returning();
    await audit(admin.id, req, 'create_plan', 'plan', inserted[0].id, { name: inserted[0].name });
    return json(res, 201, { success: true, plan: inserted[0] });
  }
  const id = parts[1];
  if (!id) return methodNotAllowed(res);
  if (req.method === 'PATCH') {
    const update = { updatedAt: new Date() };
    if (body.name !== undefined) update.name = cleanString(body.name, 80);
    if (body.price !== undefined) update.price = Number(body.price || 0);
    if (body.dailyLimit !== undefined || body.daily_limit !== undefined) update.dailyLimit = Number(body.dailyLimit || body.daily_limit || 0);
    if (body.maxDevices !== undefined || body.max_devices !== undefined) update.maxDevices = Number(body.maxDevices || body.max_devices || 1);
    if (body.activeDays !== undefined || body.active_days !== undefined) update.activeDays = Number(body.activeDays || body.active_days || 30);
    if (body.featuresJson !== undefined || body.features_json !== undefined) update.featuresJson = body.featuresJson || body.features_json || [];
    const rows = await db.update(schema.plans).set(update).where(eq(schema.plans.id, id)).returning();
    await audit(admin.id, req, 'update_plan', 'plan', id, Object.keys(update));
    return json(res, 200, { success: true, plan: rows[0] });
  }
  if (req.method === 'DELETE') {
    await db.delete(schema.plans).where(eq(schema.plans.id, id));
    await audit(admin.id, req, 'delete_plan', 'plan', id);
    return json(res, 200, { success: true });
  }
  return methodNotAllowed(res);
}

async function apiKeyRows() {
  const { db } = requireDb();
  const rows = await db.select().from(schema.apiKeys);
  return rows.map((row) => {
    let maskedKey = 'encrypted********key';
    try { maskedKey = maskSecret(decryptSecret(row.apiKeyEncrypted)); } catch {}
    return publicApiKey({ ...row, maskedKey });
  }).sort((a, b) => a.priority - b.priority);
}

async function apiKeys(req, res, admin, parts) {
  const { db } = requireDb();
  if (req.method === 'GET') return json(res, 200, { success: true, apiKeys: await apiKeyRows() });
  const body = await readBody(req);
  if (req.method === 'POST') {
    const apiKey = String(body.apiKey || body.api_key || '').trim();
    if (!apiKey) return json(res, 400, { success: false, message: 'API key wajib diisi.' });
    const inserted = await db.insert(schema.apiKeys).values({
      label: cleanString(body.label, 120) || 'AI Key',
      provider: cleanString(body.provider, 60) || 'openai-compatible',
      apiUrl: cleanString(body.apiUrl || body.api_url || process.env.AI_DEFAULT_API_URL, 1000),
      apiKeyEncrypted: encryptSecret(apiKey),
      status: body.status === 'inactive' ? 'inactive' : 'active',
      priority: Number(body.priority || 100)
    }).returning();
    await audit(admin.id, req, 'create_api_key', 'api_key', inserted[0].id, { label: inserted[0].label });
    return json(res, 201, { success: true, apiKey: (await apiKeyRows()).find((item) => item.id === inserted[0].id) });
  }
  const id = parts[1];
  if (!id) return methodNotAllowed(res);
  if (req.method === 'PATCH') {
    const update = { updatedAt: new Date() };
    if (body.label !== undefined) update.label = cleanString(body.label, 120);
    if (body.provider !== undefined) update.provider = cleanString(body.provider, 60);
    if (body.apiUrl !== undefined || body.api_url !== undefined) update.apiUrl = cleanString(body.apiUrl || body.api_url, 1000);
    if (body.status !== undefined && ['active', 'inactive'].includes(body.status)) update.status = body.status;
    if (body.priority !== undefined) update.priority = Number(body.priority || 100);
    if (body.apiKey || body.api_key) update.apiKeyEncrypted = encryptSecret(body.apiKey || body.api_key);
    await db.update(schema.apiKeys).set(update).where(eq(schema.apiKeys.id, id));
    await audit(admin.id, req, 'update_api_key', 'api_key', id, Object.keys(update));
    return json(res, 200, { success: true, apiKey: (await apiKeyRows()).find((item) => item.id === id) });
  }
  if (req.method === 'DELETE') {
    await db.delete(schema.apiKeys).where(eq(schema.apiKeys.id, id));
    await audit(admin.id, req, 'delete_api_key', 'api_key', id);
    return json(res, 200, { success: true });
  }
  return methodNotAllowed(res);
}

async function logs(req, res, parts) {
  const { sql } = requireDb();
  const query = getQuery(req);
  const type = parts[0] === 'audit-logs' ? 'audit' : (query.type || 'login');
  let rows = [];
  if (type === 'audit') rows = await sql`select * from admin_audit_logs order by created_at desc limit 200`;
  else if (type === 'chat') rows = await sql`select * from chat_logs order by created_at desc limit 200`;
  else if (type === 'usage') rows = await sql`select * from usage_logs order by created_at desc limit 200`;
  else if (type === 'error') rows = await sql`select id, label, provider, status, priority, last_error, last_used_at, updated_at from api_keys where last_error is not null order by updated_at desc limit 200`;
  else rows = await sql`select * from login_logs order by created_at desc limit 200`;
  return json(res, 200, { success: true, type, logs: rows });
}

async function settings(req, res, admin) {
  const { db, sql } = requireDb();
  if (req.method === 'GET') {
    const rows = await db.select().from(schema.settings);
    return json(res, 200, { success: true, settings: Object.fromEntries(rows.map((row) => [row.key, row.valueJson])) });
  }
  if (req.method === 'PATCH') {
    const body = await readBody(req);
    const allowed = ['maintenance_mode', 'global_announcement', 'default_plan', 'default_daily_limit'];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        await sql`
          insert into settings (key, value_json, updated_at)
          values (${key}, ${JSON.stringify(body[key])}::jsonb, now())
          on conflict (key) do update set value_json = excluded.value_json, updated_at = now()
        `;
      }
    }
    await audit(admin.id, req, 'update_settings', 'settings', 'global', body);
    const rows = await db.select().from(schema.settings);
    return json(res, 200, { success: true, settings: Object.fromEntries(rows.map((row) => [row.key, row.valueJson])) });
  }
  return methodNotAllowed(res);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 200, { success: true });

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return json(res, auth.status, { success: false, message: auth.message });
    const parts = getParts(req);
    const [root, idOrSub, action] = parts;

    if (root === 'stats' && req.method === 'GET') return stats(req, res);

    if (root === 'users') {
      if (req.method === 'GET' && !idOrSub) return listUsers(req, res);
      if (req.method === 'POST' && !idOrSub) return createUser(req, res, auth.user);
      if (req.method === 'PATCH' && idOrSub && !action) return patchUser(req, res, auth.user, idOrSub);
      if (req.method === 'DELETE' && idOrSub && !action) return deleteUser(req, res, auth.user, idOrSub);
      if (req.method === 'POST' && idOrSub && ['reset-device', 'suspend', 'unsuspend', 'extend'].includes(action)) {
        return userAction(req, res, auth.user, idOrSub, action);
      }
    }

    if (root === 'plans') return plans(req, res, auth.user, parts);
    if (root === 'api-keys') return apiKeys(req, res, auth.user, parts);
    if (root === 'logs' || root === 'audit-logs') return logs(req, res, parts);
    if (root === 'settings') return settings(req, res, auth.user);

    return json(res, 404, { success: false, message: 'Endpoint admin tidak ditemukan.' });
  } catch (error) {
    return json(res, 500, { success: false, message: error?.message || 'Admin API error.' });
  }
}
