import 'dotenv/config';
import { kimaiPool } from '../db';

async function main() {
  const host = process.env.KIMAI_DB_HOST;
  const db = process.env.KIMAI_DB_DATABASE;
  console.log(`[kimai:check] Host=${host} Database=${db}`);
  try {
    const [rows1] = await kimaiPool.query('SELECT 1 AS ok');
    console.log('[kimai:check] Basic query OK:', rows1);
  } catch (e: any) {
    console.error('[kimai:check] SELECT 1 failed:', e?.message || e);
    process.exit(1);
  }

  try {
    const [rows2]: any = await kimaiPool.query('SELECT COUNT(*) AS cnt FROM kimai2_projects');
    const count = rows2?.[0]?.cnt ?? 0;
    console.log(`[kimai:check] kimai2_projects count=${count}`);
  } catch (e: any) {
    console.warn('[kimai:check] Could not query kimai2_projects:', e?.message || e);
  }

  await kimaiPool.end();
}

main().catch((e) => {
  console.error('[kimai:check] Unexpected error:', e?.message || e);
  process.exit(1);
});

