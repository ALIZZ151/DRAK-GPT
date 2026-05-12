import postgres from 'postgres';
import { hashPassword, encryptSecret } from '../lib/security.js';

const SCHEMA_SQL = `
create extension if not exists pgcrypto;

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  name varchar(80) not null,
  price integer not null default 0,
  daily_limit integer not null default 100,
  max_devices integer not null default 1,
  active_days integer not null default 30,
  features_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username varchar(80) not null unique,
  password_hash text not null,
  role varchar(24) not null default 'user',
  status varchar(24) not null default 'active',
  plan_id uuid references plans(id) on delete set null,
  expired_at timestamptz,
  device_id text,
  device_name text,
  last_ip text,
  last_user_agent text,
  daily_used integer not null default 0,
  last_daily_reset timestamptz not null default now(),
  last_login_at timestamptz,
  created_by_admin_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_token_hash text not null unique,
  session_type varchar(24) not null default 'user',
  device_id text,
  ip_address text,
  user_agent text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  label varchar(120) not null,
  provider varchar(60) not null default 'openai-compatible',
  api_url text not null,
  api_key_encrypted text not null,
  status varchar(24) not null default 'active',
  priority integer not null default 100,
  daily_used integer not null default 0,
  total_used integer not null default 0,
  last_error text,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  message text not null,
  reply text not null,
  mode varchar(40) not null default 'default',
  provider varchar(80),
  api_key_id uuid references api_keys(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  api_key_id uuid references api_keys(id) on delete set null,
  type varchar(40) not null default 'chat',
  count integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists login_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  username varchar(80),
  role varchar(24),
  status varchar(24),
  ip_address text,
  user_agent text,
  success boolean not null default false,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references users(id) on delete set null,
  action varchar(100) not null,
  target_type varchar(60),
  target_id text,
  metadata_json jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  key varchar(100) primary key,
  value_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title varchar(160) not null,
  message text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_role_status on users(role, status);
create index if not exists idx_sessions_token_hash on sessions(session_token_hash);
create index if not exists idx_api_keys_status_priority on api_keys(status, priority);
create index if not exists idx_usage_logs_created_at on usage_logs(created_at);
create index if not exists idx_chat_logs_user_created on chat_logs(user_id, created_at);
`;

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload, null, 2));
}

export default async function handler(req, res) {
  const secret = String(req.query?.secret || '');
  const setupSecret = process.env.SETUP_SECRET || '';

  if (!setupSecret || secret !== setupSecret) {
    return json(res, 403, {
      success: false,
      message: 'SETUP_SECRET salah.'
    });
  }

  if (!process.env.DATABASE_URL) {
    return json(res, 500, {
      success: false,
      message: 'DATABASE_URL belum diisi.'
    });
  }

  if (!process.env.DEFAULT_ADMIN_USERNAME || !process.env.DEFAULT_ADMIN_PASSWORD) {
    return json(res, 500, {
      success: false,
      message: 'DEFAULT_ADMIN_USERNAME dan DEFAULT_ADMIN_PASSWORD wajib diisi.'
    });
  }

  const sql = postgres(process.env.DATABASE_URL, {
    max: 1,
    prepare: false,
    ssl: process.env.DATABASE_URL.includes('sslmode=disable') ? false : 'require'
  });

  try {
    await sql.unsafe(SCHEMA_SQL);

    const username = process.env.DEFAULT_ADMIN_USERNAME.trim().toLowerCase();
    const existingAdmin = await sql`
      select id, username from users where role = 'super_admin' limit 1
    `;

    let adminMessage = '';

    if (existingAdmin.length) {
      adminMessage = `Super admin sudah ada: ${existingAdmin[0].username}`;
    } else {
      const passwordHash = await hashPassword(process.env.DEFAULT_ADMIN_PASSWORD);

      await sql`
        insert into users (username, password_hash, role, status, expired_at)
        values (${username}, ${passwordHash}, 'super_admin', 'active', now() + interval '10 years')
      `;

      adminMessage = `Super admin berhasil dibuat: ${username}`;
    }

    const existingPlans = await sql`select id from plans limit 1`;

    if (!existingPlans.length) {
      await sql`
        insert into plans (name, price, daily_limit, max_devices, active_days, features_json)
        values
        ('Basic', 25000, 100, 1, 30, '["Chat AI", "1 perangkat"]'::jsonb),
        ('Pro', 50000, 500, 1, 30, '["Chat AI", "Coding mode", "1 perangkat"]'::jsonb),
        ('VIP', 100000, 1500, 1, 30, '["Chat AI", "Priority API", "1 perangkat"]'::jsonb)
      `;
    }

    const existingApiKeys = await sql`select id from api_keys limit 1`;

    if (!existingApiKeys.length && process.env.AI_DEFAULT_API_KEY && process.env.AI_DEFAULT_API_URL) {
      const encryptedKey = encryptSecret(process.env.AI_DEFAULT_API_KEY);

      await sql`
        insert into api_keys (label, provider, api_url, api_key_encrypted, status, priority)
        values ('Default AI Key', 'openai-compatible', ${process.env.AI_DEFAULT_API_URL}, ${encryptedKey}, 'active', 1)
      `;
    }

    return json(res, 200, {
      success: true,
      message: 'Setup database selesai.',
      admin: adminMessage,
      login_admin: {
        url: '/admin',
        username
      },
      warning: 'PENTING: setelah sukses, hapus file api/setup.js dari repo.'
    });
  } catch (error) {
    return json(res, 500, {
      success: false,
      message: error.message || 'Setup gagal.'
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
}
