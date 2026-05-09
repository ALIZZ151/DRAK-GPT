# Firebase Setup DRAK-GPT

Firebase di DRAK-GPT dipakai untuk sync riwayat chat ke Firestore. Kalau env Firebase belum diisi atau Firebase error, app tetap jalan pakai localStorage.

## 1. Buat Firebase Project

1. Buka Firebase Console.
2. Add project.
3. Nama bebas, contoh: `drak-gpt-alizz`.
4. Google Analytics boleh dimatikan dulu biar simpel.

## 2. Tambah Web App

1. Masuk Project Settings.
2. Pilih ikon Web `</>`.
3. Register app, contoh nama: `DRAK-GPT Web`.
4. Ambil config ini:

```js
apiKey
appId
authDomain
projectId
storageBucket
messagingSenderId
```

## 3. Aktifkan Anonymous Auth

1. Firebase Console → Authentication.
2. Klik Get started.
3. Tab Sign-in method.
4. Aktifkan **Anonymous**.

DRAK-GPT memakai Anonymous Auth lewat REST API, jadi tidak perlu dependency Firebase SDK yang berat.

## 4. Aktifkan Firestore Database

1. Firebase Console → Firestore Database.
2. Create database.
3. Pilih Production mode.
4. Region pilih yang dekat/umum.

## 5. Pasang Firestore Rules

Buka Firestore Database → Rules, lalu isi:

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

Rules ini bikin setiap anonymous user cuma bisa baca/tulis data miliknya sendiri berdasarkan UID Firebase.

## 6. Isi Environment Variables di Vercel

Vercel → Project → Settings → Environment Variables.

Isi semua ini dari Firebase web config:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Setelah isi env, klik **Redeploy**.

## 7. Cek Hasil

Di sidebar DRAK-GPT, status akan berubah:

- `Local Session`: Firebase belum aktif / env belum lengkap.
- `Firebase Ready`: env sudah ada, auth akan dibuat saat sync pertama.
- `Firebase Sync`: riwayat sudah sync memakai Firebase Anonymous Auth.

Data tersimpan di Firestore:

```txt
users/{firebaseAnonymousUid}/chats/{chatId}
```

## Catatan Penting

- Firebase API key web bukan secret seperti token backend, tapi tetap jangan taruh credential admin/service account di GitHub.
- Jangan pakai rules `allow read, write: if true` untuk production.
- Attachment gambar disimpan versi ringan/thumbnail agar dokumen Firestore tidak jebol limit ukuran.
- Kalau Firestore gagal, chat tetap aman di localStorage.
