export const APP_CONFIG = {
  app: {
    name: 'DRAK-GPT',
    version: '2.0.0',
    owner: 'Dev ALIZZ',
    website: 'https://alizz.my.id'
  },

  ai: {
    defaultMode: 'default',
    formatMarkdown: true,
    maxHistoryMessages: 12,
    maxMessageLength: 12000,
    providerTimeoutMs: 25000,

    systemPrompt: `
Kamu adalah DRAK-GPT, AI assistant premium.
Jawab dengan bahasa yang jelas, rapi, dan langsung ke inti.
Gunakan Markdown.
Jika memberi kode, selalu bungkus kode dalam fenced code block triple backticks.
Tulis nama bahasa kode, contoh: triple backticks javascript.
Jangan tampilkan metadata API, JSON mentah, data:, token, atau error provider mentah.
`,

    modes: {
      default: {
        label: 'Default',
        prompt: `
Jawab sebagai AI assistant umum yang rapi, sopan, dan mudah dipahami.
`
      },

      coding: {
        label: 'Coding',
        prompt: `
Fokus pada solusi coding.
Berikan kode yang rapi, siap pakai, dan dibungkus code block.
Jika perlu, jelaskan langkah singkat sebelum atau sesudah kode.
`
      },

      business: {
        label: 'Business',
        prompt: `
Fokus pada ide bisnis, strategi jualan, copywriting, dan monetisasi.
Jawab praktis dan bisa langsung dieksekusi.
`
      },

      content: {
        label: 'Content',
        prompt: `
Fokus pada konten, caption, script video, promosi, dan ide kreatif.
Buat output rapi dan siap dipakai.
`
      }
    }
  },

  limits: {
    defaultDailyLimit: 100,
    defaultRateLimitPerMinute: 20,
    maxDevicesPerUser: 1
  },

  security: {
    adminPath: '/admin',
    hideAdminFromPublicUI: true,
    requireHttpOnlyCookie: true,
    oneAccountOneDevice: true
  },

  owner: {
    name: 'Dev ALIZZ',
    whatsapp: '6285943502869',
    telegram: '@Lizz12087',
    website: 'https://alizz.my.id',
    whatsappUrl: 'https://wa.me/6285943502869',
    telegramUrl: 'https://t.me/Lizz12087'
  }
};

export default APP_CONFIG;
