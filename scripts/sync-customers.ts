import 'dotenv/config';
import { kimaiPool, atlasPool } from '../db';

async function createStaging(live: string, stg: string) {
  await atlasPool.query(`DROP TABLE IF EXISTS \`${stg}\``);
  await atlasPool.query(`CREATE TABLE \`${stg}\` LIKE \`${live}\``);
}

async function insertBatch(table: string, rows: any[]) {
  if (!rows.length) return;
  const cols = ['id','name','visible','timezone','currency'];
  const ph = '(' + cols.map(() => '?').join(',') + ')';
  const values: any[] = [];
  for (const r of rows) values.push(r.id, r.name, r.visible, r.timezone ?? null, null);
  const sql = `INSERT INTO \`${table}\` (${cols.join(',')}) VALUES ${rows.map(() => ph).join(',')}`;
  await atlasPool.query(sql, values);
}

async function swapTables(live: string, stg: string) {
  const old = `${live}_old`;
  await atlasPool.query(`RENAME TABLE \`${live}\` TO \`${old}\`, \`${stg}\` TO \`${live}\``);
  await atlasPool.query(`DROP TABLE IF EXISTS \`${old}\``);
}

async function main() {
  console.log('[sync:customers] Full refresh (staging-and-swap)');
  // Ensure live table exists (for environments where migrations didn't create it)
  await atlasPool.query(`CREATE TABLE IF NOT EXISTS \`replica_kimai_customers\` (
    \`id\` int NOT NULL,
    \`name\` varchar(191),
    \`visible\` tinyint(1),
    \`timezone\` varchar(64),
    \`currency\` varchar(8),
    \`synced_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(\`id\`)
  )`);
  const live = 'replica_kimai_customers';
  const stg = 'replica_kimai_customers_stg';
  await createStaging(live, stg);
  const [rows]: any = await kimaiPool.query('SELECT id, name, visible, timezone FROM kimai2_customers');
  await insertBatch(stg, rows);
  await swapTables(live, stg);
  console.log(`[sync:customers] Swap complete. Rows: ${rows.length}`);
  await atlasPool.query(
    'INSERT INTO sync_state (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value=VALUES(state_value), updated_at=CURRENT_TIMESTAMP',
    ['sync.customers.last_run', new Date().toISOString()]
  );
  await kimaiPool.end();
  await atlasPool.end();
}

main().catch((e) => { console.error('[sync:customers] Failed:', e?.message || e); process.exit(1); });
