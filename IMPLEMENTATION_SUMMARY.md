# DRAK-GPT v2 Implementation Summary

## Ringkasan perubahan

Project diubah menjadi platform jual akses AI premium dengan:

- Firebase/Firestore/Auth lama dihapus total.
- Login user/admin custom berbasis username + password hash bcryptjs.
- Session user/admin memakai HttpOnly cookie server-side.
- Database PostgreSQL serverless dengan Drizzle ORM schema.
- Admin panel private di `/admin`, tanpa link dari UI publik.
- Admin bisa kelola user, plan, API key encrypted, logs, dan settings.
- User dashboard di `/dashboard` untuk cek paket, expired date, status, device, dan limit harian.
- One account one device memakai `device_id` browser.
- `/api/chat` wajib cek session, status akun, expired date, daily limit, prompt `/config.js`, API key fallback, logs, dan usage.
- Prompt AI dipindah ke `/config.js` server-side.
- Config publik dipisah ke `src/config.public.js`.

## File yang diubah

- `.env.example`
- `README.md`
- `api/chat.js`
- `api/health.js`
- `package.json`
- `src/App.jsx`
- `src/aiProviders.js`
- `src/components/ChatHeader.jsx`
- `src/components/ChatSidebar.jsx`
- `src/components/LoginGate.jsx`
- `src/database.js`
- `src/styles.css`
- `src/utils/storage.js`
- `vercel.json`

## File baru

- `config.js`
- `IMPLEMENTATION_SUMMARY.md`
- `api/auth/login.js`
- `api/auth/logout.js`
- `api/auth/me.js`
- `api/admin/login.js`
- `api/admin/logout.js`
- `api/admin/me.js`
- `api/admin/[...path].js`
- `api/user/dashboard.js`
- `lib/auth.js`
- `lib/http.js`
- `lib/provider.js`
- `lib/security.js`
- `lib/db/index.js`
- `lib/db/schema.js`
- `scripts/schema.sql`
- `scripts/init-db.js`
- `scripts/seed-admin.js`
- `src/config.public.js`
- `src/pages/AdminApp.jsx`
- `src/pages/DashboardPage.jsx`

## File yang dihapus

- `src/firebase.js`
- `api/access.js`
- `firestore.rules`
- `FIREBASE_SETUP.md`
- `FIREBASE_UPGRADE_NOTES.md`
- `_.env.example`

## Env Vercel yang wajib diisi

```env
DATABASE_URL=
SESSION_SECRET=
API_KEY_ENCRYPTION_SECRET=
DEFAULT_ADMIN_USERNAME=
DEFAULT_ADMIN_PASSWORD=
AI_DEFAULT_API_URL=
NODE_ENV=production
APP_BASE_URL=https://alizz.my.id
```

Opsional:

```env
AI_DEFAULT_API_KEY=
AI_DEFAULT_MODEL=
```

Jangan pakai env Firebase dan jangan simpan secret dengan prefix `VITE_`.

## Cara setup database

```bash
npm install
npm run db:init
```

## Cara seed super admin

```bash
export DATABASE_URL="postgresql://..."
export SESSION_SECRET="minimal-24-karakter-rahasia"
export API_KEY_ENCRYPTION_SECRET="minimal-24-karakter-rahasia"
export DEFAULT_ADMIN_USERNAME="admin"
export DEFAULT_ADMIN_PASSWORD="password-kuat-min-8"
npm run seed:admin
```

## Cara deploy ke Vercel

1. Push repo ke GitHub.
2. Import ke Vercel sebagai Vite app.
3. Isi env wajib.
4. Deploy.
5. Jalankan `npm run db:init` dan `npm run seed:admin` dari lokal dengan env production.

## Cara test login admin

1. Buka `/admin`.
2. Login dengan super_admin hasil seed.
3. Buka tabs Dashboard, Users, Plans, API Keys, Logs, Settings.

## Cara test login user

1. Di admin, buat plan dan user.
2. Buka `/login`.
3. Login user.
4. Buka `/dashboard` untuk lihat plan, expired, status, device, dan limit.
5. Buka `/` untuk chat.

## Cara test one account one device

1. Login user di browser utama.
2. Login user yang sama di browser lain/incognito.
3. Login kedua harus ditolak dengan pesan device locked.
4. Admin klik Reset Device.
5. User bisa login ulang dari device baru.

## Cara test fallback API key

1. Buka `/admin` → API Key Manager.
2. Tambahkan 2 API key aktif.
3. Set priority key pertama lebih kecil.
4. Buat key pertama invalid/limit.
5. Kirim chat.
6. Sistem akan simpan last_error pada key gagal dan mencoba key berikutnya.

## Hasil build/check

```bash
npm run check
```

Hasil: berhasil.

```text
vite v8.0.11 building client environment for production...
✓ 35 modules transformed.
✓ built
```
