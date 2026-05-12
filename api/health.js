import { APP_CONFIG } from '../config.js';
import { json } from '../lib/http.js';

export default function handler(req, res) {
  return json(res, 200, {
    success: true,
    app: APP_CONFIG.app.name,
    version: APP_CONFIG.app.version,
    status: 'ok',
    auth: 'HttpOnly cookie',
    database: 'PostgreSQL',
    firebase: false,
    timestamp: new Date().toISOString()
  });
}
