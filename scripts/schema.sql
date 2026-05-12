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
