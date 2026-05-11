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
- Provider chat completions baru via serverless proxy.
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

Catatan: serverless provider utama berada di `api/chat.js` agar API key tetap aman di backend, bukan di frontend.

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

Versi ini sudah ditambah Firebase sync yang lebih aman:

- Firestore untuk riwayat chat.
- Firebase Anonymous Auth via REST API, jadi tidak perlu dependency Firebase SDK besar.
- LocalStorage tetap jadi fallback kalau Firebase belum aktif/error.
- Riwayat local lama otomatis dicoba sync ke Firestore saat Firebase pertama kali aktif.
- Attachment gambar disimpan versi ringan agar Firestore tidak jebol ukuran dokumen.

File bantuan lengkap ada di:

```txt
FIREBASE_SETUP.md
firestore.rules
```

Langkah cepat:

1. Buat project Firebase.
2. Tambah Web App dan ambil Firebase web config.
3. Aktifkan **Authentication → Anonymous**.
4. Aktifkan **Firestore Database**.
5. Pasang rules dari `firestore.rules`:

```txt
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

6. Isi Environment Variables di Vercel berdasarkan `.env.example`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

7. Deploy ulang.

Status di sidebar:

- **Local Session**: Firebase belum aktif / env belum lengkap.
- **Firebase Ready**: env lengkap, auth akan dibuat saat sync pertama.
- **Firebase Sync**: riwayat chat sudah memakai Firestore + Anonymous Auth.

Data chat disimpan dengan pola:

```txt
users/{firebaseAnonymousUid}/chats/{chatId}
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
      role: 'user' | 'assistant',
      content,
      createdAt,
      attachments: []
    }
  ]
}
```

Catatan keamanan: Firebase web config boleh dipakai di frontend, tapi **service account/admin key jangan pernah dimasukin ke GitHub**. Jangan pakai rules `allow read, write: if true` untuk web yang mau dipost.


## Update API Baru v1.5.0

Versi ini sudah memakai satu provider OpenAI-compatible di `api/chat.js`:

- Endpoint default: `https://api.wormgpt.pw/v1/chat/completions`
- Request dikirim sebagai JSON `{ "messages": [...] }`
- Tidak ada system prompt, mode prompt, atau prompt internal tambahan dari server.
- Riwayat chat tetap dikirim sebagai `messages` agar percakapan nyambung.
- API key tidak di-hardcode. Simpan di Vercel Environment Variables:

```env
WORMGPT_API_KEY=ISI_KEY_ASLI_DI_VERCEL
```

Alternatif lama `DRAK_PROVIDER_API_KEY` juga masih dibaca backend. Jangan masukkan key asli ke frontend, GitHub, atau file publik.

## Cara Ganti API Provider

Konfigurasi publik UI ada di:

```txt
src/database.js
```

Proxy provider utama ada di:

```txt
api/chat.js
```

Untuk ganti endpoint/provider:

1. Ubah `WORMGPT_API_URL` di Vercel Environment Variables, atau ubah default URL di `src/database.js`.
2. Simpan token di `WORMGPT_API_KEY` atau `DRAK_PROVIDER_API_KEY`.
3. Kalau format response berbeda, edit fungsi `extractReply()` di `api/chat.js`.
4. Jangan menaruh API key di file frontend, GitHub, atau file publik.

Contoh environment backend:

```env
WORMGPT_API_KEY=ISI_KEY_ASLI_DI_VERCEL
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

## Update v1.1 — UI/UX + Access Gate + Karakter AI

Update ini melanjutkan project yang sudah ada, bukan rebuild dari nol.

Perubahan utama:

- Loading page dibuat lebih premium dengan frame sudut, glow, scanning line, particle ringan, dan progress bar.
- Setelah loading ada access gate frontend:
  - Key: `5J4ZU89`
  - Password: `DRAK-GPT`
  - Status login disimpan di `localStorage`.
  - Ini hanya access gate tampilan, bukan sistem keamanan server sungguhan.
- Sidebar/hamburger sekarang drawer kanan dan default tertutup di mobile, tablet, dan desktop.
- Empty state dibuat clean: logo + `SELAMAT DATANG DI DRAK-GPT` dengan typing effect ringan.
- Input composer diturunkan dan dibuat lebih nyaman untuk mobile safe area.
- Ditambahkan micro animation ringan untuk tombol, drawer, bubble chat, input focus, model selector, dan loading state.
- Tombol logout ditambahkan di sidebar untuk menghapus status access gate.
- Prompt AI diperkuat dengan karakter DRAK-GPT: bahasa Indonesia santai, ceplas-ceplos, toxic tipis tapi tetap sopan.
- Prompt internal/server-side sudah dihapus.
- `/api/chat` sekarang mengirim `messages` langsung ke provider baru tanpa system prompt tambahan.
- Response cleaner ditambahkan agar balasan kosong/formal berlebihan tidak langsung tampil mentah.

Catatan deploy:

- `package-lock.json` tidak wajib untuk Vercel. Kalau deployment gagal di tahap `npm install`, hapus `package-lock.json` lalu redeploy.
- Build command tetap `npm run build` dan output directory tetap `dist`.
