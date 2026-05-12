# DRAK-GPT v2 Premium Access Platform

DRAK-GPT v2 mengubah project React/Vite lama menjadi platform jual akses AI premium berbasis Vercel Serverless API + PostgreSQL. Firebase sudah dihapus total.

## Stack

- Frontend: React + Vite
- Backend: Vercel Serverless API routes
- Database: PostgreSQL serverless, rekomendasi Neon Postgres
- ORM: Drizzle ORM schema + postgres-js runtime
- Auth: custom username/password
- Password: bcryptjs hash
- Session: HttpOnly cookie server-side
- API key AI: encrypted di database

## Env Vercel wajib

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

Jangan gunakan env Firebase dan jangan pakai prefix `VITE_` untuk secret.

## Setup database

1. Buat database Neon Postgres.
2. Copy connection string ke `DATABASE_URL`.
3. Jalankan:

```bash
npm install
npm run db:init
```

## Seed super admin

Isi env lokal atau Vercel:

```bash
export DATABASE_URL="postgresql://..."
export SESSION_SECRET="minimal-24-karakter-rahasia"
export API_KEY_ENCRYPTION_SECRET="minimal-24-karakter-rahasia"
export DEFAULT_ADMIN_USERNAME="admin"
export DEFAULT_ADMIN_PASSWORD="password-kuat-min-8"
npm run seed:admin
```

Script hanya membuat super_admin jika belum ada super_admin di database.

## Jalankan lokal

```bash
npm install
npm run db:init
npm run seed:admin
npm run dev
```

## Deploy ke Vercel

1. Push repo ke GitHub.
2. Import project ke Vercel.
3. Isi semua env wajib.
4. Deploy.
5. Jalankan `npm run db:init` dan `npm run seed:admin` dari mesin lokal yang punya env database produksi.

## Route utama

User:

- `/login`
- `/dashboard`
- `/`

Admin private:

- `/admin`
- `/admin/login`
- `/admin/dashboard`
- `/admin/users`
- `/admin/api-keys`
- `/admin/plans`
- `/admin/logs`
- `/admin/settings`

Tidak ada link admin di UI publik.

## API route penting

Auth user:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Chat:

- `POST /api/chat`

Admin:

- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/me`
- `GET /api/admin/stats`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `DELETE /api/admin/users/:id`
- `POST /api/admin/users/:id/reset-device`
- `POST /api/admin/users/:id/suspend`
- `POST /api/admin/users/:id/unsuspend`
- `POST /api/admin/users/:id/extend`
- `GET/POST/PATCH/DELETE /api/admin/plans`
- `GET/POST/PATCH/DELETE /api/admin/api-keys`
- `GET /api/admin/logs`
- `GET /api/admin/audit-logs`

User:

- `GET /api/user/dashboard`

## Cara test

### Login admin

1. Buka `/admin`.
2. Login pakai super admin hasil seed.
3. Buat plan dan user.

### Login user

1. Buka `/login` atau `/`.
2. Login pakai user yang dibuat admin.
3. Buka `/dashboard` untuk cek paket, expired date, device, dan limit.

### One account one device

1. Login user di browser A.
2. Login user yang sama di browser B/incognito.
3. Login kedua harus ditolak dengan pesan device locked.
4. Admin buka Users → Reset Device.
5. User bisa login dari perangkat baru.

### Fallback API key

1. Buka `/admin` → API Key Manager.
2. Tambahkan minimal dua API key aktif dengan priority berbeda.
3. Buat key pertama invalid/limit.
4. Kirim chat.
5. Sistem mencoba key berikutnya, menyimpan `last_error`, dan mencatat usage log jika sukses.

## Prompt AI

Prompt AI server-side ada di `/config.js`. Backend `/api/chat` mengambil:

1. `APP_CONFIG.ai.systemPrompt`
2. Prompt mode: `default`, `coding`, `business`, atau `content`
3. Digabung sebagai system message ke provider AI

Frontend tidak meng-import `/config.js` server-side. Config tampilan publik ada di `src/config.public.js`.
