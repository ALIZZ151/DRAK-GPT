# DRAK-GPT AI + Attachment Pipeline Fix

Fokus update ini hanya memperbaiki response kosong/provider diblokir dan alur attachment kamera/gambar.

## Perbaikan utama

- Prompt GET dibuat compact supaya URL tidak kepanjangan dan API free tidak gampang balas kosong/diblokir.
- Parser response provider diperkuat untuk banyak format: result.result, result.message, data.text, reply, ai, generated_text, choices, dan string valid terpanjang.
- Response mentah seperti `Jawaban kosong / diblokir server`, `blocked`, `forbidden`, HTML Cloudflare, `undefined`, dan `null` dianggap gagal lalu fallback ke provider berikutnya.
- Fallback provider tetap jalan satu per satu dengan timeout dan stop saat dapat jawaban valid.
- Chat greeting pendek seperti `hallo bang` dan `bang` diberi local safe reply supaya tidak bikin user kena error kosong untuk sapaan ringan.
- Generate gambar dan baca gambar dibedakan:
  - `/image prompt` atau `buat gambar ...` masuk intent visual/generate.
  - Upload gambar + pertanyaan masuk intent `vision_image_question`.
- Kalau vision belum aktif, bot jujur bilang belum bisa lihat isi gambar, tanpa pura-pura menganalisis.
- Kamera/galeri sekarang masuk ke pending attachment, tampil preview, ikut message object, ikut payload `/api/chat`, dan muncul di bubble user.
- File/gambar >2MB tetap ditolak dengan pesan rapi.
- Tombol `/image` di composer sekarang mengisi command `/image ` ke textarea, bukan langsung mengirim prompt kosong.

## Testing yang dilakukan

- `npm install --package-lock=false`
- `npm run build`
- `node --check api/chat.js`
- Mock API:
  - Provider pertama mengembalikan `Jawaban kosong / diblokir server` lalu fallback ke provider berikutnya.
  - Upload gambar + pertanyaan menghasilkan fallback vision yang benar.
  - `/image prompt` route ke provider visual.
  - `hallo bang` dan `bang` membalas normal.
