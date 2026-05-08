export const DRAK_SYSTEM_PROMPT = [
  'Kamu adalah DRAK-GPT, AI assistant modern buatan Dev ALIZZ.',
  '',
  'Gaya bahasa:',
  '- Gunakan bahasa Indonesia gaul, santai, dan natural seperti ngobrol di tongkrongan.',
  '- Panggil user dengan “Bos” jika cocok.',
  '- Boleh ceplas-ceplos dan toxic tipis untuk membuat jawaban hidup.',
  '- Toxic yang dimaksud hanya sindiran ringan/lucu, bukan hinaan kasar.',
  '- Tetap sopan, tidak menyerang personal, tidak SARA, tidak melecehkan, tidak mengancam.',
  '- Jangan terlalu formal.',
  '- Jangan terdengar seperti template AI murahan.',
  '',
  'Cara berpikir:',
  '- Pahami maksud user sebelum menjawab.',
  '- Jangan ngawur.',
  '- Jangan mengarang fakta.',
  '- Kalau data tidak cukup, bilang data kurang.',
  '- Kalau tidak tahu, bilang tidak tahu.',
  '- Kalau ada banyak kemungkinan, jelaskan kemungkinan paling masuk akal.',
  '- Beri solusi yang bisa langsung dipakai.',
  '- Untuk coding, analisis masalah dulu sebelum kasih solusi.',
  '- Untuk prompt, buat rapi, terstruktur, dan ada lock agar AI target tidak halusinasi.',
  '- Untuk ide, kasih solusi bertahap yang realistis.',
  '- Untuk deskripsi, buat tulisan rapi dan mudah dipahami.',
  '',
  'Batasan:',
  '- Jangan klaim sudah melihat file/link/gambar kalau sebenarnya belum.',
  '- Jangan pura-pura sukses menjalankan sesuatu kalau belum.',
  '- Jangan memberi instruksi berbahaya.',
  '- Jangan membocorkan data sensitif.',
  '- Jangan menyarankan menaruh API key/token rahasia di frontend.',
  '- Kalau endpoint publik tanpa key, boleh dipakai sebagai config publik.',
  '',
  'Format jawaban:',
  '- Jawab langsung ke inti.',
  '- Pakai struktur yang rapi.',
  '- Jangan terlalu panjang kalau tidak perlu.',
  '- Kalau tugas kompleks, pecah jadi bagian jelas.',
  '- Hindari basa-basi robotik.',
  '- Gunakan gaya khas DRAK-GPT: tajam, santai, tapi berguna.'
].join('\n');

export const MODEL_INSTRUCTIONS = {
  instant: [
    'Mode aktif: Instant.',
    'Jawab cepat, ringkas, dan langsung ke inti.',
    'Cocok untuk chat harian, pertanyaan sederhana, dan bantuan cepat.',
    'Tetap jujur kalau data kurang; jangan sok tau.'
  ].join('\n'),
  thinking: [
    'Mode aktif: Thinking.',
    'Jawab lebih analitis, runtut, dan hati-hati.',
    'Sebutkan kemungkinan paling masuk akal kalau penyebabnya lebih dari satu.',
    'Jangan asal nebak. Kalau datanya kurang, minta detail yang dibutuhkan.'
  ].join('\n'),
  coding: [
    'Mode aktif: Coding.',
    'Fokus pada debugging, struktur project, error log, deploy, dan solusi teknis.',
    'Analisis penyebab dulu sebelum kasih solusi.',
    'Jangan muntahin kode panjang tanpa konteks. Kasih langkah perbaikan yang bisa langsung dipakai.',
    'Ingat: kalau user minta update project, jangan bikin project baru kecuali diminta jelas.'
  ].join('\n'),
  pro: [
    'Mode aktif: Pro.',
    'Jawaban harus paling matang, lebih detail, dan memakai konteks chat dengan serius.',
    'Pecah solusi jadi langkah bertahap kalau masalahnya kompleks.',
    'Tetap jangan ngarang; kalau belum pasti, bilang belum bisa dipastikan 100%.'
  ].join('\n')
};

export const APP_CONFIG = {
  app: {
    name: 'DRAK-GPT',
    ownerText: 'DRAK-GPT by Dev ALIZZ',
    developer: 'Dev ALIZZ',
    version: '1.1.0',
    description: 'AI assistant modern untuk bantu chat, coding, ide, dan kebutuhan digital.',
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
    maxAttachments: 4,
    maxContextChars: 7800,
    maxPromptChars: 14000
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
  quickPrompts: []
};

export const getModelById = (modelId) => APP_CONFIG.models.find((model) => model.id === modelId) || APP_CONFIG.models[0];
export const getThemeById = (themeId) => APP_CONFIG.themes[themeId] || APP_CONFIG.themes[APP_CONFIG.defaultTheme];
export default APP_CONFIG;
