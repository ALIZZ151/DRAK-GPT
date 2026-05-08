# DRAK-GPT — AI Assistant by Dev ALIZZ

DRAK-GPT adalah website AI assistant modern berbasis Vite + React, dibuat untuk chat AI, bantuan coding, ide, tulisan, upload file kecil, preview gambar/kamera, riwayat chat, tema, Firebase sync, dan deploy cepat ke Vercel.

Branding dibuat mandiri sebagai **DRAK-GPT by Dev ALIZZ**. Project ini tidak memakai logo, nama, atau aset resmi ChatGPT/OpenAI.

## Fitur Utama

- UI chat modern dark red cyber + glassmorphism.
- Loading page menggunakan `public/icon.jpg`.
- Background chat menggunakan `public/vd.jpg` sebagai placeholder visual.
- Model selector: Instant, Thinking, Coding, Pro.
- API proxy serverless di `/api/chat` agar provider distandarkan dan error terkendali.
- Provider AI free/public:
  - LexCode GPT5 Nano
  - Nexray ChatGPT
  - Nexray Claude
  - Nexray Copilot
  - Nexray Deepseek
  - Adapter DPHN placeholder karena format method/body belum pasti.
- Fallback provider otomatis saat provider utama error.
- Riwayat chat tersimpan di localStorage dan bisa sync ke Firestore jika Firebase env diisi.
- Sidebar/hamburger, pencarian riwayat, chat baru, rename, hapus chat, hapus semua.
- Upload file kecil TXT/JSON/MD, preview gambar, kamera mobile.
- Fallback elegan untuk fitur vision/generate image yang belum aktif.
- Theme settings: Red Core, Blue Neon, Purple Night, Dark Minimal.
- Command modern: `/help`, `/new`, `/clear`, `/theme red`, `/coding`, `/thinking`, `/pro`, `/image`.
- SEO/OG preview siap pakai `icon.jpg`.
- PWA ringan tanpa service worker kompleks.
- Security headers di `vercel.json`.
- Rate limit sederhana di serverless function.

## Struktur Project

```txt
/public
  icon.jpg
  vd.jpg
  manifest.webmanifest
  robots.txt

/src
  main.jsx
  App.jsx
  styles.css
  database.js
  firebase.js
  aiProviders.js       # opsional untuk pengembangan provider berikutnya
  utils/
    storage.js
    fileReader.js
    rateLimit.js
    sanitize.js
  components/
    LoadingScreen.jsx
    ChatLayout.jsx
    ChatHeader.jsx
    ChatSidebar.jsx
    ChatInput.jsx
    MessageBubble.jsx
    ModelSelector.jsx
    ThemeSettings.jsx
    FilePreview.jsx
    EmptyState.jsx

/api
  chat.js
  health.js

vercel.json
package.json
.env.example
README.md
```

Catatan: `aiProviders.js` bisa ditambahkan/diisi untuk memindahkan konfigurasi provider frontend kalau nanti diperlukan. Serverless provider utama saat ini berada di `api/chat.js` agar rahasia dan fallback tetap terkendali dari backend.

## Cara Install

```bash
npm install
```

## Cara Run Lokal

```bash
npm run dev
```

Buka alamat yang muncul dari Vite, biasanya:

```txt
http://localhost:5173
```

## Cara Build

```bash
npm run build
```

Output build ada di folder `dist`.

## Cara Preview Build

```bash
npm run preview
```

## Deploy ke Vercel

1. Push project ini ke GitHub.
2. Buka Vercel.
3. Import repository GitHub.
4. Framework preset: **Vite**.
5. Build command: `npm run build`.
6. Output directory: `dist`.
7. Deploy.

`vercel.json` sudah menyiapkan:

- Serverless functions di `/api/*.js`.
- Security headers dasar.
- SPA fallback ke `index.html`.

## Firebase Setup

DRAK-GPT tetap jalan tanpa Firebase. Kalau env Firebase belum diisi, mode otomatis menjadi **Local Session**.

Untuk mengaktifkan Firestore sync:

1. Buat project Firebase.
2. Aktifkan Firestore Database.
3. Ambil Firebase web config.
4. Isi environment variables di Vercel berdasarkan `.env.example`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

5. Deploy ulang.

Data chat disimpan dengan pola:

```txt
users/{sessionId}/chats/{chatId}
```

Struktur chat:

```js
{
  id,
  title,
  model,
  createdAt,
  updatedAt,
  messages: [
    {
      id,
      role: 'user' | 'assistant' | 'system',
      content,
      createdAt,
      attachments: []
    }
  ]
}
```

## Cara Ganti API Provider

Konfigurasi publik UI ada di:

```txt
src/database.js
```

Proxy provider utama ada di:

```txt
api/chat.js
```

Untuk menambah provider baru:

1. Tambahkan provider di `PROVIDERS` pada `api/chat.js`.
2. Buat parser jika format responsenya berbeda.
3. Tambahkan provider ke chain model di `MODELS`.
4. Kalau butuh API key/token, jangan taruh di frontend. Simpan di Vercel Environment Variables.

Contoh rahasia backend:

```js
const token = process.env.DRAK_PROVIDER_API_KEY;
```

## Cara Ganti icon.jpg dan vd.jpg

Ganti file berikut:

```txt
public/icon.jpg
public/vd.jpg
```

`icon.jpg` dipakai untuk:

- Loading page.
- Logo visual DRAK-GPT.
- Favicon.
- Open Graph image WhatsApp/Telegram.
- Manifest icon.

`vd.jpg` dipakai untuk:

- Background chat.
- Placeholder background video anime.

Kalau nanti punya video, taruh:

```txt
public/bg-video.mp4
```

UI sudah mencoba load video itu otomatis. Kalau tidak ada, fallback tetap `vd.jpg`.

## Cara Ganti Kontak Owner

Buka:

```txt
src/database.js
```

Ubah bagian:

```js
owner: {
  name: 'Dev ALIZZ',
  whatsapp: 'ISI_NOMOR_OWNER_DI_SINI',
  telegram: 'ISI_USERNAME_TELEGRAM_DI_SINI'
}
```

Contoh WhatsApp gunakan angka internasional tanpa `+`:

```js
whatsapp: '628xxxxxxxxxx'
```

Contoh Telegram:

```js
telegram: 'username_telegram'
```

## Domain IDHost ke Vercel

Alur umum:

1. Deploy project di Vercel.
2. Buka Project Settings → Domains.
3. Tambahkan domain/subdomain dari IDHost.
4. Di panel DNS IDHost, arahkan record sesuai instruksi Vercel.
   - Untuk root domain biasanya memakai A record Vercel.
   - Untuk subdomain biasanya memakai CNAME ke Vercel.
5. Tunggu propagasi DNS.
6. Pastikan SSL aktif otomatis di Vercel.

## Sambungkan Cloudflare

Alur umum:

1. Tambahkan domain ke Cloudflare.
2. Ubah nameserver domain di IDHost ke nameserver Cloudflare.
3. Setelah aktif, buat DNS record menuju Vercel sesuai instruksi Vercel.
4. Mode SSL direkomendasikan **Full** atau **Full (strict)** jika sertifikat sudah benar.
5. Aktifkan proteksi Cloudflare yang aman seperti cache static asset, bot fight mode, dan rate limit bila diperlukan.

Cloudflare membantu proteksi domain dari request berlebihan, tapi kode tetap sudah punya validasi dasar dan rate limit sederhana.

## Catatan Keamanan

- Endpoint publik/free boleh ada di config, tapi frontend tetap kirim ke `/api/chat`.
- API key/token rahasia wajib disimpan di Vercel Environment Variables.
- Jangan hardcode data sensitif di GitHub.
- Output AI tidak dirender sebagai raw HTML.
- File upload dibatasi 2MB.
- Tipe file dibatasi.
- Serverless API punya validasi message dan rate limit sederhana.
- Security headers dasar aktif lewat `vercel.json`.

## Checklist Testing

Setelah install dan run, cek:

- Loading page muncul.
- Masuk ke chat setelah loading.
- Kirim `halo`.
- Bubble assistant muncul.
- Ganti model berjalan.
- Chat Baru berjalan.
- Riwayat tersimpan setelah reload.
- Sidebar/hamburger kanan berjalan di mobile.
- Tema berubah dan tersimpan.
- Upload TXT kecil terbaca.
- Upload file besar ditolak.
- Upload gambar muncul preview.
- API error tidak crash.
- Firebase kosong tetap localStorage.
- Build Vercel tidak error.

## Developer

DRAK-GPT by Dev ALIZZ.
