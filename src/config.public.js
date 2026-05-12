export const PUBLIC_CONFIG = {
  app: {
    name: 'DRAK-GPT',
    ownerText: 'DRAK-GPT by Dev ALIZZ',
    developer: 'Dev ALIZZ',
    version: '2.0.0',
    description: 'AI assistant premium dengan auth aman, limit harian, dan admin panel private.',
    storagePrefix: 'drak_gpt_v2'
  },
  owner: {
    name: 'Dev ALIZZ',
    whatsapp: '6285943502869',
    telegram: '@Lizz12087',
    website: 'https://alizz.my.id',
    whatsappUrl: 'https://wa.me/6285943502869',
    telegramUrl: 'https://t.me/Lizz12087'
  },
  modes: [
    { id: 'default', label: 'Default', badge: 'AI', description: 'Mode umum rapi dan cepat' },
    { id: 'coding', label: 'Coding', badge: 'CODE', description: 'Fokus solusi coding dan code block' },
    { id: 'business', label: 'Business', badge: 'BIZ', description: 'Ide bisnis, jualan, strategi, dan monetisasi' },
    { id: 'content', label: 'Content', badge: 'POST', description: 'Caption, script, promosi, dan konten kreatif' }
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
    allowedTypes: ['text/plain', 'application/json', 'text/markdown', 'image/png', 'image/jpeg', 'image/webp', 'application/pdf']
  },
  limits: {
    maxMessageLength: 12000,
    clientCooldownMs: 700,
    maxAttachments: 4,
    maxContextChars: 7800,
    maxPromptChars: 7000,
    maxGetPromptChars: 2200,
    providerTimeoutMs: 25000
  },
  features: {
    imageGeneration: false,
    vision: false,
    fileReading: true,
    localStorageFallback: true,
    backgroundVideo: true
  },
  share: {
    website: 'https://alizz.my.id',
    loginNote: 'Login memakai username/password premium dari admin.'
  },
  quickPrompts: []
};

export default PUBLIC_CONFIG;
