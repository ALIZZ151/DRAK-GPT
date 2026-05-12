import { requireAdmin } from '../../lib/auth.js';
import { json } from '../../lib/http.js';
import { safeUser } from '../../lib/security.js';

export default async function handler(req, res) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return json(res, auth.status, { success: false, message: auth.message });
    return json(res, 200, { success: true, admin: safeUser(auth.user) });
  } catch (error) {
    return json(res, 500, { success: false, message: error?.message || 'Admin auth error.' });
  }
}
