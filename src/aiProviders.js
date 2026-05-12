// Public provider metadata only. Secret API keys are managed server-side in PostgreSQL.
export const aiProviders = [
  { id: 'openai-compatible', label: 'OpenAI-compatible API', enabled: true, note: 'Managed from /admin/api-keys' }
];

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
