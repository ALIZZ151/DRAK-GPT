import { PUBLIC_CONFIG } from './config.public.js';

export const APP_CONFIG = {
  ...PUBLIC_CONFIG,
  models: PUBLIC_CONFIG.modes,
  accessGate: {
    enabled: true,
    endpoint: '/api/auth/login',
    storageKey: 'server_http_only_cookie'
  }
};

export const getModelById = (modelId) => APP_CONFIG.models.find((model) => model.id === modelId) || APP_CONFIG.models[0];
export const getThemeById = (themeId) => APP_CONFIG.themes[themeId] || APP_CONFIG.themes[APP_CONFIG.defaultTheme];
export default APP_CONFIG;
