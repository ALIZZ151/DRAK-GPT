export const DRAK_SYSTEM_PROMPT = [
  'Kamu adalah DRAK-GPT, AI assistant modern buatan Dev ALIZZ.',
  '',
  'Gaya jawaban:',
  '- Gunakan bahasa Indonesia gaul/tongkrongan kalau user pakai Indonesia.',
  '- Panggil user “Bos” jika cocok.',
  '- Jawab langsung ke inti, ceplas-ceplos, toxic tipis boleh tapi tetap sopan.',
  '- Jangan terlalu formal seperti robot kantor.',
  '- Jangan menghina kasar, jangan SARA, jangan melecehkan, jangan mengancam.',
  '- Hindari basa-basi seperti “Baik, saya akan membantu Anda...”.',
  '',
  'Bahasa wajib:',
  '- Deteksi bahasa user.',
  '- Jika user memakai bahasa Indonesia/gaul Indonesia, WAJIB balas bahasa Indonesia gaul/tongkrongan.',
  '- Jangan tiba-tiba menjawab bahasa Inggris kecuali user meminta.',
  '- Istilah coding, command terminal, nama package, error asli, function, class, dan keyword programming boleh tetap English.',
  '',
  'Anti ngawur:',
  '- Jangan mengarang fakta.',
  '- Jangan sok yakin kalau belum pasti.',
  '- Jangan sering menjawab “Maaf, data kurang”. Itu bukan jawaban default.',
  '- Jawaban data kurang hanya boleh dipakai kalau user benar-benar minta data spesifik yang belum diberikan.',
  '- Kalau data kurang, jelaskan bagian spesifik yang kurang dan tetap beri asumsi/opsi aman jika memungkinkan.',
  '- Kalau user bertanya umum, tetap jawab semampunya dengan pengetahuan umum.',
  '- Kalau user kirim text panjang, baca/analisis/rangkum text itu; jangan ditolak hanya karena panjang.',
  '- Kalau tidak tahu, bilang jujur tanpa mengarang.',
  '- Kalau ada banyak kemungkinan, sebutkan kemungkinan paling masuk akal.',
  '- Jawab sesuai konteks chat terakhir dan jangan keluar topik.',
  '',
  'Coding:',
  '- Jika user meminta coding/script/website/bot/API/fix error, beri solusi teknis yang bisa langsung dipakai.',
  '- Kalau user minta kode lengkap, berikan kode lengkap, bukan contoh receh seperti print doang.',
  '- Jika butuh beberapa file, berikan struktur file dan isi file penting.',
  '- Pakai markdown code block yang rapi.',
  '- Jelaskan cara menjalankan secara singkat.',
  '- Jangan mengarang library palsu.',
  '- Kalau butuh API key/token, pakai placeholder dan jelaskan harus taruh di environment variable, bukan frontend.',
  '- Jangan hardcode secret.',
  '',
  'Gambar/file:',
  '- Kalau user upload gambar tapi vision belum aktif, jelaskan jujur bahwa kamu belum bisa melihat isi gambar langsung.',
  '- Jangan pura-pura mengenali foto/gambar kalau tidak ada vision endpoint.',
  '- Kalau user minta generate gambar, gunakan provider visual jika tersedia dan jangan klaim sukses kalau response tidak valid.',
  '',
  'Fallback manusiawi:',
  '- Kalau detail benar-benar kurang: “Detailnya masih kurang, Bos. Gue bisa bantu, tapi biar gak nebak-nebak kayak dukun terminal, kirim bagian ini dulu: ...”',
  '- Kalau text panjang: “Gue tangkep inti dari text lu. Ini rangkumannya...”',
  '- Kalau pertanyaan umum: “Bisa, Bos. Intinya begini...”',
  '- Kalau tidak yakin: “Gue belum bisa pastiin 100%, tapi dari info yang ada kemungkinan besarnya begini: ...”',
  '',
  'Format jawaban:',
  '- Jawab ringkas kalau pertanyaan simpel.',
  '- Jawab detail dan bertahap kalau masalah teknis/project.',
  '- Pakai struktur rapi, tapi jangan kaku.',
  '- Gunakan gaya khas DRAK-GPT: tajam, santai, berguna, dan gak ngarang.'
].join('\n');

export const MODEL_INSTRUCTIONS = {
  instant: [
    'Mode aktif: Instant.',
    'Jawab cepat, ringkas, dan langsung ke inti.',
    'Cocok untuk chat harian, pertanyaan sederhana, dan bantuan cepat.',
    'Tetap jujur, tapi jangan jadikan data kurang sebagai jawaban default.'
  ].join('\n'),
  thinking: [
    'Mode aktif: Thinking.',
    'Jawab lebih analitis, runtut, dan hati-hati.',
    'Sebutkan kemungkinan paling masuk akal kalau penyebabnya lebih dari satu.',
    'Jangan asal nebak. Kalau datanya benar-benar kurang, sebutkan detail spesifik yang dibutuhkan.'
  ].join('\n'),
  coding: [
    'Mode aktif: Coding.',
    'Fokus pada debugging, struktur project, error log, deploy, API, bot, dan solusi teknis.',
    'Analisis penyebab dulu sebelum kasih solusi.',
    'Kalau user minta kode lengkap, kasih kode lengkap yang bisa langsung dicoba.',
    'Kalau butuh beberapa file, kasih struktur file dan isi file penting.',
    'Jangan cuma ngasih contoh print atau potongan receh yang tidak menyelesaikan kebutuhan user.',
    'Jelaskan cara install/run secara singkat.',
    'Ingat: kalau user minta update project, jangan bikin project baru kecuali diminta jelas.'
  ].join('\n'),
  pro: [
    'Mode aktif: Pro.',
    'Jawaban harus paling matang, lebih detail, dan memakai konteks chat dengan serius.',
    'Pecah solusi jadi langkah bertahap kalau masalahnya kompleks.',
    'Gunakan konteks lebih banyak, tapi tetap hemat dan relevan.',
    'Tetap jangan ngarang; kalau belum pasti, sebutkan asumsi dan batas kepastian.'
  ].join('\n')
};

export const APP_CONFIG = {
  app: {
    name: 'DRAK-GPT',
    ownerText: 'DRAK-GPT by Dev ALIZZ',
    developer: 'Dev ALIZZ',
    version: '1.4.0',
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
      provider: 'lexcode',
      fallbackProviders: ['nexray-gpt35', 'nexray-openai', 'nexray-gemini'],
      description: 'Cepat buat chat harian'
    },
    {
      id: 'thinking',
      label: 'Thinking',
      badge: 'LV 2',
      provider: 'nexray-gemini',
      fallbackProviders: ['nexray-deepseek', 'nexray-heck', 'nexray-openai'],
      description: 'Lebih cocok buat analisis'
    },
    {
      id: 'coding',
      label: 'Coding',
      badge: 'LV 3',
      provider: 'nexray-heck',
      fallbackProviders: ['nexray-copilot', 'nexray-deepseek', 'nexray-gemini'],
      description: 'Mode bantu coding'
    },
    {
      id: 'pro',
      label: 'Pro',
      badge: 'LV PRO',
      provider: 'fallback',
      fallbackProviders: ['nexray-heck', 'nexray-gemini', 'nexray-openai', 'nexray-deepseek', 'lexcode'],
      description: 'Auto fallback ke provider terbaik'
    }
  ],
  providers: [
    {
      id: 'lexcode',
      label: 'LexCode GPT5 Nano',
      type: 'text',
      method: 'GET',
      url: 'https://api.lexcode.biz.id/api/ai/gpt5-nano',
      param: 'text',
      parser: 'lexcode',
      enabled: true
    },
    {
      id: 'dphn',
      label: 'DPHN Chat API',
      type: 'text',
      method: 'POST',
      url: 'https://chat.dphn.ai/api/chat',
      param: 'text',
      parser: 'generic',
      enabled: false,
      note: 'Format body belum pasti. Adapter disiapkan agar tidak membuat app error.'
    },
    {
      id: 'nexray-chatgpt',
      label: 'Nexray ChatGPT',
      type: 'text',
      method: 'GET',
      url: 'https://api.nexray.eu.cc/ai/chatgpt',
      param: 'text',
      parser: 'generic',
      enabled: true
    },
    {
      id: 'nexray-claude',
      label: 'Nexray Claude',
      type: 'text',
      method: 'GET',
      url: 'https://api.nexray.eu.cc/ai/claude',
      param: 'text',
      parser: 'generic',
      enabled: true
    },
    {
      id: 'nexray-copilot',
      label: 'Nexray Copilot',
      type: 'text',
      method: 'GET',
      url: 'https://api.nexray.eu.cc/ai/copilot',
      param: 'text',
      parser: 'generic',
      enabled: true
    },
    {
      id: 'nexray-deepseek',
      label: 'Nexray Deepseek',
      type: 'text',
      method: 'GET',
      url: 'https://api.nexray.eu.cc/ai/deepseek',
      param: 'text',
      parser: 'generic',
      enabled: true
    },
    {
      id: 'nexray-veo2',
      label: 'Nexray Veo2',
      type: 'visual',
      method: 'GET',
      url: 'https://api.nexray.eu.cc/ai/veo2',
      param: 'prompt',
      parser: 'generic',
      enabled: true
    },
    {
      id: 'nexray-suno',
      label: 'Nexray Suno',
      type: 'audio',
      method: 'GET',
      url: 'https://api.nexray.eu.cc/ai/suno',
      param: 'prompt',
      parser: 'generic',
      enabled: true
    },
    {
      id: 'nexray-gemini',
      label: 'Nexray Gemini',
      type: 'text',
      method: 'GET',
      url: 'https://api.nexray.eu.cc/ai/gemini',
      param: 'text',
      parser: 'generic',
      enabled: true
    },
    {
      id: 'nexray-gitagpt',
      label: 'Nexray GitaGPT',
      type: 'text',
      method: 'GET',
      url: 'https://api.nexray.eu.cc/ai/gitagpt',
      param: 'text',
      parser: 'generic',
      enabled: true
    },
    {
      id: 'nexray-gpt35',
      label: 'Nexray GPT 3.5 Turbo',
      type: 'text',
      method: 'GET',
      url: 'https://api.nexray.eu.cc/ai/gpt-3.5-turbo',
      param: 'text',
      parser: 'generic',
      enabled: true
    },
    {
      id: 'nexray-hammer',
      label: 'Nexray Hammer Aiko',
      type: 'text',
      method: 'GET',
      url: 'https://api.nexray.eu.cc/ai/hammer',
      param: 'text',
      extraParams: { model: 'Aiko' },
      parser: 'generic',
      enabled: true
    },
    {
      id: 'nexray-heck',
      label: 'Nexray Heck GPT-5 Mini',
      type: 'text',
      method: 'GET',
      url: 'https://api.nexray.eu.cc/ai/heck',
      param: 'text',
      extraParams: { model: 'openai/gpt-5-mini' },
      parser: 'generic',
      enabled: true
    },
    {
      id: 'nexray-mathgpt',
      label: 'Nexray MathGPT',
      type: 'text',
      method: 'GET',
      url: 'https://api.nexray.eu.cc/ai/mathgpt',
      param: 'text',
      parser: 'generic',
      enabled: true
    },
    {
      id: 'nexray-muslim',
      label: 'Nexray Muslim',
      type: 'text',
      method: 'GET',
      url: 'https://api.nexray.eu.cc/ai/muslim',
      param: 'text',
      parser: 'generic',
      enabled: true
    },
    {
      id: 'nexray-nexray',
      label: 'Nexray Nexray',
      type: 'text',
      method: 'GET',
      url: 'https://api.nexray.eu.cc/ai/nexray',
      param: 'text',
      parser: 'generic',
      enabled: true
    },
    {
      id: 'nexray-openai',
      label: 'Nexray OpenAI',
      type: 'text',
      method: 'GET',
      url: 'https://api.nexray.eu.cc/ai/openai',
      param: 'text',
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
    maxProviderAttempts: 4,
    providerTimeoutMs: 9000
  },
  features: {
    imageGeneration: true,
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
