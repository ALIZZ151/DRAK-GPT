import { APP_CONFIG } from '../src/database.js';

export default function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({
    success: true,
    app: APP_CONFIG.app.name,
    owner: APP_CONFIG.app.developer,
    status: 'ok',
    providers: APP_CONFIG.providers
      .filter((provider) => provider.enabled !== false)
      .map((provider) => ({ id: provider.id, label: provider.label, type: provider.type, method: provider.method })),
    limits: {
      maxGetPromptChars: APP_CONFIG.limits.maxGetPromptChars,
      maxProviderAttempts: APP_CONFIG.limits.maxProviderAttempts,
      providerTimeoutMs: APP_CONFIG.limits.providerTimeoutMs
    },
    timestamp: new Date().toISOString()
  }));
}
