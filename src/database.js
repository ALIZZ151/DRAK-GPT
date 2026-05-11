export const DRAK_SYSTEM_PROMPT = '';

export const MODEL_INSTRUCTIONS = {
  instant: '',
  thinking: '',
  coding: '',
  pro: ''
};

export const APP_CONFIG = {
  app: {
    name: 'DRAK-GPT',
    ownerText: 'DRAK-GPT by Dev ALIZZ',
    developer: 'Dev ALIZZ',
    version: '1.5.0',
    description: 'AI assistant modern dengan provider chat completions baru.',
    storagePrefix: 'drak_gpt_v1'
  },
  // Demo access gate only, not real authentication.
  accessGate: {
    enabled: true,
    storageKey: 'drak_gpt_access_ok',
    key: '5J4ZU89',
    password: 'DRAK-GPT'
  },
  owner: {
    name: 'Dev ALIZZ',
    whatsapp: '6285943502869',
    telegram: '@Lizz12087',
    website: 'https://alizz.my.id',
    whatsappUrl: 'https://wa.me/6285943502869',
    telegramUrl: 'https://t.me/Lizz12087'
  },
  models: [
    {
      id: 'instant',
      label: 'Instant',
      badge: 'LV 1',
      provider: 'wormgpt',
      fallbackProviders: [],
      description: 'Chat cepat via API baru'
    },
    {
      id: 'thinking',
      label: 'Thinking',
      badge: 'LV 2',
      provider: 'wormgpt',
      fallbackProviders: [],
      description: 'Mode UI saja; server tidak menambah prompt'
    },
    {
      id: 'coding',
      label: 'Coding',
      badge: 'LV 3',
      provider: 'wormgpt',
      fallbackProviders: [],
      description: 'Mode UI saja; server tidak menambah prompt'
    },
    {
      id: 'pro',
      label: 'Pro',
      badge: 'LV PRO',
      provider: 'wormgpt',
      fallbackProviders: [],
      description: 'Mode UI saja; server tidak menambah prompt'
    }
  ],
  providers: [
    {
      id: 'wormgpt',
      label: 'WormGPT Chat Completions',
      type: 'text',
      method: 'POST',
      url: 'https://api.wormgpt.pw/v1/chat/completions',
      parser: 'openai-compatible',
      enabled: true,
      note: 'API key disimpan di server melalui WORMGPT_API_KEY atau DRAK_PROVIDER_API_KEY.'
    }
  ],
  themes: {
    red: {
      id: 'red',
      label: 'Red Core',
      accent: '#ff2d4d',
      accent2: '#a60820',
      glow: 'rgba(255, 45, 77, .45)',
      bg: '#090102'
    },
    blue: {
      id: 'blue',
      label: 'Blue Neon',
      accent: '#38bdf8',
      accent2: '#155e75',
      glow: 'rgba(56, 189, 248, .42)',
      bg: '#020712'
    },
    purple: {
      id: 'purple',
      label: 'Purple Night',
      accent: '#a855f7',
      accent2: '#581c87',
      glow: 'rgba(168, 85, 247, .42)',
      bg: '#090313'
    },
    dark: {
      id: 'dark',
      label: 'Dark Minimal',
      accent: '#d4d4d8',
      accent2: '#3f3f46',
      glow: 'rgba(212, 212, 216, .25)',
      bg: '#030303'
    }
  },
  defaultTheme: 'red',
  upload: {
    maxSizeMB: 2,
    maxSizeBytes: 2 * 1024 * 1024,
    maxOriginalImageMB: 10,
    maxOriginalImageBytes: 10 * 1024 * 1024,
    targetImageBytes: 1 * 1024 * 1024,
    imageMaxWidth: 1280,
    imageMaxHeight: 1280,
    imageQuality: 0.78,
    allowedTypes: [
      'text/plain',
      'application/json',
      'text/markdown',
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/pdf'
    ]
  },
  limits: {
    maxMessageLength: 12000,
    clientCooldownMs: 700,
    maxAttachments: 4,
    maxContextChars: 7800,
    maxPromptChars: 7000,
    maxGetPromptChars: 2200,
    longTextThreshold: 2500,
    maxProviderAttempts: 1,
    providerTimeoutMs: 20000
  },
  features: {
    imageGeneration: false,
    vision: false,
    fileReading: true,
    firebaseSync: true,
    localStorageFallback: true,
    backgroundVideo: true
  },
  systemPrompt: DRAK_SYSTEM_PROMPT,
  modelInstructions: MODEL_INSTRUCTIONS,
  share: {
    website: 'https://alizz.my.id',
    key: '5J4ZU89',
    password: 'DRAK-GPT'
  },
  quickPrompts: []
};

export const getModelById = (modelId) => APP_CONFIG.models.find((model) => model.id === modelId) || APP_CONFIG.models[0];
export const getThemeById = (themeId) => APP_CONFIG.themes[themeId] || APP_CONFIG.themes[APP_CONFIG.defaultTheme];
export default APP_CONFIG;
