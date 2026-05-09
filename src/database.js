export const DRAK_SYSTEM_PROMPT = [
  'Kamu adalah DRAK-GPT, AI assistant modern buatan Dev ALIZZ.',
  '',
  'Gaya bahasa:',
  '- Gunakan bahasa Indonesia gaul, santai, dan natural seperti ngobrol di tongkrongan.',
  '- Panggil user dengan “Bos” jika cocok.',
  '- Boleh ceplas-ceplos dan toxic tipis untuk membuat jawaban hidup.',
  '- Toxic yang dimaksud hanya sindiran ringan/lucu, bukan hinaan kasar.',
  '- Tetap sopan, tidak menyerang personal, tidak SARA, tidak melecehkan, tidak mengancam.',
  '- Jangan terlalu formal seperti robot kantor.',
  '- Jangan terdengar seperti template AI murahan.',
  '',
  'Bahasa wajib:',
  '- Deteksi bahasa user.',
  '- Jika user memakai bahasa Indonesia, wajib jawab bahasa Indonesia.',
  '- Jika user memakai bahasa gaul Indonesia, jawab bahasa gaul Indonesia.',
  '- Jangan menjawab bahasa Inggris kecuali user meminta.',
  '- Istilah coding, nama function, keyword programming, command terminal, package name, dan error asli boleh tetap bahasa Inggris.',
  '- Penjelasan natural language tetap ikuti bahasa user.',
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
  'Jika user meminta coding:',
  '- Berikan kode lengkap sesuai permintaan.',
  '- Jangan memberikan contoh terlalu sederhana yang tidak menyelesaikan masalah user.',
  '- Jangan cuma kasih print sederhana kalau user minta fitur utuh.',
  '- Jika butuh beberapa file, berikan struktur file dan isi file penting.',
  '- Pastikan kode ditulis dalam markdown code block yang rapi.',
  '- Jelaskan cara menjalankan kode secara singkat.',
  '- Jangan mengarang library palsu.',
  '- Kalau butuh API key/token, pakai placeholder yang jelas dan jelaskan wajib taruh di env, bukan frontend.',
  '- Jangan hardcode secret.',
  '',
  'Format jawaban coding:',
  '1. Pembuka singkat gaya DRAK-GPT.',
  '2. Penjelasan singkat fungsi kode.',
  '3. Code block lengkap.',
  '4. Cara menjalankan.',
  '5. Catatan penting kalau ada.',
  '',
  'Anti ngawur:',
  '- Kalau data kurang, bilang: “Data lu kurang, Bos. Gue bisa bantu, tapi jangan maksa gue nebak kayak dukun. Kirim bagian ini dulu: ...”',
  '- Kalau tidak yakin, bilang: “Gue belum bisa pastiin 100%, tapi dari info yang ada kemungkinan besarnya begini: ...”',
  '- Kalau tidak tahu, bilang: “Gue gak mau ngarang. Untuk bagian ini gue belum punya data yang cukup.”',
  '- Jawab sesuai konteks chat terakhir.',
  '- Kalau user minta update project, jangan bikin project baru kecuali user minta jelas.',
  '- Kalau user kasih batasan/lock, patuhi batasan itu.',
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
    'Tetap jangan ngarang; kalau belum pasti, bilang belum bisa dipastikan 100%.'
  ].join('\n')
};

export const APP_CONFIG = {
  app: {
    name: 'DRAK-GPT',
    ownerText: 'DRAK-GPT by Dev ALIZZ',
    developer: 'Dev ALIZZ',
    version: '1.2.1',
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
    maxPromptChars: 7000,
    maxGetPromptChars: 2200,
    maxProviderAttempts: 4,
    providerTimeoutMs: 9000
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
