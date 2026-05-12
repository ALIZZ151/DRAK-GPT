import postgres from 'postgres';
import { hashPassword } from '../lib/security.js';

const { DATABASE_URL, DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD } = process.env;

if (!DATABASE_URL) {
  console.error('DATABASE_URL belum diisi.');
  process.exit(1);
}
if (!DEFAULT_ADMIN_USERNAME || !DEFAULT_ADMIN_PASSWORD) {
  console.error('DEFAULT_ADMIN_USERNAME dan DEFAULT_ADMIN_PASSWORD wajib diisi.');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  max: 1,
  prepare: false,
  ssl: DATABASE_URL.includes('sslmode=disable') ? false : 'require'
});

try {
  const username = DEFAULT_ADMIN_USERNAME.trim().toLowerCase();
  const existing = await sql`select id, username from users where role = 'super_admin' limit 1`;
  if (existing.length) {
    console.log(`Super admin sudah ada: ${existing[0].username}`);
  } else {
    const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
    const rows = await sql`
      insert into users (username, password_hash, role, status, expired_at)
      values (${username}, ${passwordHash}, 'super_admin', 'active', now() + interval '10 years')
      returning id, username
    `;
    console.log(`Super admin dibuat: ${rows[0].username}`);
  }
} finally {
  await sql.end({ timeout: 1 });
}
