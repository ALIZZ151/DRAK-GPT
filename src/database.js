export const APP_CONFIG = {
  app: {
    name: 'DRAK-GPT',
    ownerText: 'DRAK-GPT by Dev ALIZZ',
    developer: 'Dev ALIZZ',
    version: '1.0.0',
    description: 'AI assistant modern untuk bantu chat, coding, ide, dan kebutuhan digital.',
    storagePrefix: 'drak_gpt_v1'
  },
  owner: {
    name: 'Dev ALIZZ',
    whatsapp: 'ISI_NOMOR_OWNER_DI_SINI',
    telegram: 'ISI_USERNAME_TELEGRAM_DI_SINI'
  },
  models: [
    {
      id: 'instant',
      label: 'Instant',
      badge: 'LV 1',
      provider: 'lexcode',
      fallbackProviders: ['nexray-chatgpt'],
      description: 'Cepat buat chat harian'
    },
    {
      id: 'thinking',
      label: 'Thinking',
      badge: 'LV 2',
      provider: 'nexray-deepseek',
      fallbackProviders: ['nexray-claude', 'lexcode'],
      description: 'Lebih cocok buat analisis'
    },
    {
      id: 'coding',
      label: 'Coding',
      badge: 'LV 3',
      provider: 'nexray-copilot',
      fallbackProviders: ['nexray-deepseek', 'lexcode'],
      description: 'Mode bantu coding'
    },
    {
      id: 'pro',
      label: 'Pro',
      badge: 'LV PRO',
      provider: 'fallback',
      fallbackProviders: ['lexcode', 'nexray-chatgpt', 'nexray-claude', 'nexray-deepseek', 'nexray-copilot'],
      description: 'Auto fallback ke provider terbaik'
    }
  ],
  providers: [
    {
      id: 'lexcode',
      label: 'LexCode GPT5 Nano',
      method: 'GET',
      url: 'https://api.lexcode.biz.id/api/ai/gpt5-nano?text={text}',
      parser: 'lexcode',
      enabled: true
    },
    {
      id: 'dphn',
      label: 'DPHN Chat API',
      method: 'POST',
      url: 'https://chat.dphn.ai/api/chat',
      parser: 'generic',
      enabled: false,
      note: 'Format body belum pasti. Adapter disiapkan agar tidak membuat app error.'
    },
    {
      id: 'nexray-chatgpt',
      label: 'Nexray ChatGPT',
      method: 'GET',
      url: 'https://api.nexray.eu.cc/ai/chatgpt?text={text}',
      parser: 'generic',
      enabled: true
    },
    {
      id: 'nexray-claude',
      label: 'Nexray Claude',
      method: 'GET',
      url: 'https://api.nexray.eu.cc/ai/claude?text={text}',
      parser: 'generic',
      enabled: true
    },
    {
      id: 'nexray-copilot',
      label: 'Nexray Copilot',
      method: 'GET',
      url: 'https://api.nexray.eu.cc/ai/copilot?text={text}',
      parser: 'generic',
      enabled: true
    },
    {
      id: 'nexray-deepseek',
      label: 'Nexray Deepseek',
      method: 'GET',
      url: 'https://api.nexray.eu.cc/ai/deepseek?text={text}',
      parser: 'generic',
      enabled: true
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
    maxMessageLength: 8000,
    clientCooldownMs: 700,
    maxAttachments: 4
  },
  features: {
    imageGeneration: false,
    vision: false,
    fileReading: true,
    firebaseSync: true,
    localStorageFallback: true,
    backgroundVideo: true
  },
  systemPrompt: [
    'Kamu adalah DRAK-GPT, AI assistant modern buatan Dev ALIZZ.',
    'Jawab dengan jelas, ramah, dan praktis.',
    'Untuk coding, berikan solusi yang aman, rapi, dan mudah dipahami.',
    'Jangan mengaku sebagai brand resmi ChatGPT atau OpenAI.'
  ].join(' '),
  quickPrompts: [
    'Bantu buat script website',
    'Jelaskan error coding',
    'Buat caption promosi',
    'Buat ide bisnis digital'
  ]
};

export const getModelById = (modelId) => APP_CONFIG.models.find((model) => model.id === modelId) || APP_CONFIG.models[0];
export const getThemeById = (themeId) => APP_CONFIG.themes[themeId] || APP_CONFIG.themes[APP_CONFIG.defaultTheme];
export default APP_CONFIG;
