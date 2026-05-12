import fs from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL belum diisi.');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  prepare: false,
  ssl: process.env.DATABASE_URL.includes('sslmode=disable') ? false : 'require'
});

const schemaPath = path.join(process.cwd(), 'scripts', 'schema.sql');
const schemaSql = await fs.readFile(schemaPath, 'utf8');

try {
  await sql.unsafe(schemaSql);
  console.log('Database schema DRAK-GPT berhasil dibuat/diupdate.');
} finally {
  await sql.end({ timeout: 1 });
}
