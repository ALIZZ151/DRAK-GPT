import { boolean, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 80 }).notNull(),
  price: integer('price').default(0).notNull(),
  dailyLimit: integer('daily_limit').default(100).notNull(),
  maxDevices: integer('max_devices').default(1).notNull(),
  activeDays: integer('active_days').default(30).notNull(),
  featuresJson: jsonb('features_json').default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 80 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 24 }).default('user').notNull(),
  status: varchar('status', { length: 24 }).default('active').notNull(),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'set null' }),
  expiredAt: timestamp('expired_at', { withTimezone: true }),
  deviceId: text('device_id'),
  deviceName: text('device_name'),
  lastIp: text('last_ip'),
  lastUserAgent: text('last_user_agent'),
  dailyUsed: integer('daily_used').default(0).notNull(),
  lastDailyReset: timestamp('last_daily_reset', { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdByAdminId: uuid('created_by_admin_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  sessionTokenHash: text('session_token_hash').notNull().unique(),
  sessionType: varchar('session_type', { length: 24 }).default('user').notNull(),
  deviceId: text('device_id'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  label: varchar('label', { length: 120 }).notNull(),
  provider: varchar('provider', { length: 60 }).default('openai-compatible').notNull(),
  apiUrl: text('api_url').notNull(),
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  status: varchar('status', { length: 24 }).default('active').notNull(),
  priority: integer('priority').default(100).notNull(),
  dailyUsed: integer('daily_used').default(0).notNull(),
  totalUsed: integer('total_used').default(0).notNull(),
  lastError: text('last_error'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const chatLogs = pgTable('chat_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  message: text('message').notNull(),
  reply: text('reply').notNull(),
  mode: varchar('mode', { length: 40 }).default('default').notNull(),
  provider: varchar('provider', { length: 80 }),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const usageLogs = pgTable('usage_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 40 }).default('chat').notNull(),
  count: integer('count').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const loginLogs = pgTable('login_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  username: varchar('username', { length: 80 }),
  role: varchar('role', { length: 24 }),
  status: varchar('status', { length: 24 }),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  success: boolean('success').default(false).notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminId: uuid('admin_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  targetType: varchar('target_type', { length: 60 }),
  targetId: text('target_id'),
  metadataJson: jsonb('metadata_json').default({}).notNull(),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const settings = pgTable('settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  valueJson: jsonb('value_json').default({}).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const announcements = pgTable('announcements', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 160 }).notNull(),
  message: text('message').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});
