import { getSessionUser, userPlanStatus } from '../../lib/auth.js';
import { requireDb, schema } from '../../lib/db/index.js';
import { eq } from 'drizzle-orm';
import { json } from '../../lib/http.js';
import { safeUser } from '../../lib/security.js';

export default async function handler(req, res) {
  try {
    const session = await getSessionUser(req, 'user');
    if (!session) return json(res, 401, { success: false, message: 'Belum login.' });
    const { db } = requireDb();
    const planRows = session.user.planId
      ? await db.select().from(schema.plans).where(eq(schema.plans.id, session.user.planId)).limit(1)
      : [];
    return json(res, 200, {
      success: true,
      user: { ...safeUser(session.user), accountStatus: userPlanStatus(session.user) },
      plan: planRows[0] || null
    });
  } catch (error) {
    return json(res, 500, { success: false, message: error?.message || 'Auth check error.' });
  }
}
