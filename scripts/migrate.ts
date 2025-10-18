import 'dotenv/config';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { db } from '../src/db/client';
import { atlasPool } from '../db';
import fs from 'fs';
import path from 'path';

async function main() {
  const folder = path.resolve(process.cwd(), 'drizzle');
  const files = fs.readdirSync(folder).filter((f) => f.endsWith('.sql')).sort();
  console.log('[migrate] files:', files);
  await migrate(db, { migrationsFolder: 'drizzle' });
  console.log('[migrate] Migrations applied');
  try {
    const [rows]: any = await atlasPool.query('SELECT * FROM `__drizzle_migrations` ORDER BY `id`');
    console.log('[migrate] __drizzle_migrations:', rows);
  } catch (e: any) {
    console.warn('[migrate] could not read __drizzle_migrations:', e?.message || e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[migrate] failed:', e?.message || e);
    process.exit(1);
  });
