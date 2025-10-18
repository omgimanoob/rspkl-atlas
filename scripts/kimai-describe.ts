import 'dotenv/config';
import { kimaiPool } from '../db';

async function describe(table: string) {
  const [rows]: any = await kimaiPool.query(`SHOW COLUMNS FROM \`${table}\``);
  return rows.map((r: any) => ({ Field: r.Field, Type: r.Type, Null: r.Null, Key: r.Key, Default: r.Default, Extra: r.Extra }));
}

async function main() {
  // Discover all tables in the current Kimai database
  let tables: string[] = [];
  try {
    const [rows]: any = await kimaiPool.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name'
    );
    tables = rows.map((r: any) => r.table_name || r.TABLE_NAME);
  } catch (e: any) {
    console.warn('[kimai:describe] Failed to list tables via information_schema, falling back to SHOW TABLES:', e?.message || e);
    try {
      const [rows2]: any = await kimaiPool.query('SHOW TABLES');
      const key = rows2.length ? Object.keys(rows2[0])[0] : '';
      tables = rows2.map((r: any) => r[key]);
    } catch (e2: any) {
      console.error('[kimai:describe] Failed to list tables:', e2?.message || e2);
      process.exit(1);
    }
  }

  for (const t of tables) {
    try {
      const cols = await describe(t);
      console.log(`\n# ${t}`);
      console.table(cols);
    } catch (e: any) {
      console.error(`[kimai:describe] Failed to describe ${t}:`, e?.message || e);
    }
  }
  await kimaiPool.end();
}

main().catch((e) => {
  console.error('[kimai:describe] Unexpected error:', e?.message || e);
  process.exit(1);
});
