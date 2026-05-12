import { revokeSession } from '../../lib/auth.js';
import { json, methodNotAllowed } from '../../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  try {
    await revokeSession(req, res, 'admin');
    return json(res, 200, { success: true });
  } catch {
    return json(res, 200, { success: true });
  }
}
