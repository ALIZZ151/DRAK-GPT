import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('[DRAK-GPT] DATABASE_URL belum diset. API database akan gagal sampai env diisi.');
}

const client = connectionString
  ? postgres(connectionString, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl: connectionString.includes('sslmode=disable') ? false : 'require'
    })
  : null;

export const db = client ? drizzle(client, { schema }) : null;
export const sql = client;
export { schema };

export function requireDb() {
  if (!db || !sql) throw new Error('DATABASE_URL belum diset. Isi env DATABASE_URL di Vercel/localhost.');
  return { db, sql };
}

export async function closeDb() {
  if (client) await client.end({ timeout: 1 });
}
