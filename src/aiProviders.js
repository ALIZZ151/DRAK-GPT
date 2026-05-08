import { APP_CONFIG } from './database.js';

export const aiProviders = APP_CONFIG.providers;

export function getProviderById(providerId) {
  return aiProviders.find((provider) => provider.id === providerId) || null;
}

export function getProviderHealthList() {
  return aiProviders.map((provider) => ({
    id: provider.id,
    label: provider.label,
    enabled: provider.enabled !== false,
    note: provider.note || ''
  }));
}
