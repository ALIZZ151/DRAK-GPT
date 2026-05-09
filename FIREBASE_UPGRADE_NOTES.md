# DRAK-GPT Firebase Upgrade 1.4

Upgrade ini menambah Firebase sync yang lebih siap dipost tanpa merusak fallback localStorage.

## Yang Ditambah

- Firebase Anonymous Auth via REST API.
- Firestore REST dengan Authorization Bearer token.
- Rules aman per user UID di `firestore.rules`.
- LocalStorage tetap aktif sebagai fallback.
- Auto migration: chat local lama akan dicoba sync ke Firestore saat Firebase aktif.
- Attachment gambar dislim untuk cloud supaya Firestore tidak error karena dokumen terlalu besar.
- Dokumentasi setup lengkap di `FIREBASE_SETUP.md`.

## Status Sidebar

- `Local Session`: env Firebase belum lengkap atau Firebase belum aktif.
- `Firebase Ready`: env lengkap, auth siap dibuat.
- `Firebase Sync`: auth sudah tersimpan dan chat bisa sync ke Firestore.

## Wajib di Firebase Console

1. Authentication → Anonymous → Enable.
2. Firestore Database → Create.
3. Rules → pakai isi `firestore.rules`.
4. Vercel Environment Variables → isi semua `VITE_FIREBASE_*`.
5. Redeploy.
