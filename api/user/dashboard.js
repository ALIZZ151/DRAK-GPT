import { eq } from 'drizzle-orm';
import { APP_CONFIG } from '../../config.js';
import { getSessionUser, userPlanStatus } from '../../lib/auth.js';
import { requireDb, schema } from '../../lib/db/index.js';
import { json, methodNotAllowed } from '../../lib/http.js';
import { safeUser } from '../../lib/security.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  try {
    const auth = await getSessionUser(req, 'user');
    if (!auth) return json(res, 401, { success: false, message: 'Silakan login dulu.' });
    const { db } = requireDb();
    const plan = auth.user.planId
      ? (await db.select().from(schema.plans).where(eq(schema.plans.id, auth.user.planId)).limit(1))[0]
      : null;
    const dailyLimit = plan?.dailyLimit || APP_CONFIG.limits.defaultDailyLimit;
    return json(res, 200, {
      success: true,
      user: { ...safeUser(auth.user), accountStatus: userPlanStatus(auth.user) },
      plan,
      limit: {
        dailyLimit,
        dailyUsed: auth.user.dailyUsed || 0,
        remaining: Math.max(0, dailyLimit - (auth.user.dailyUsed || 0))
      },
      owner: APP_CONFIG.owner
    });
  } catch (error) {
    return json(res, 500, { success: false, message: error?.message || 'Dashboard error.' });
  }
}
