import 'dotenv/config';
import { kimaiPool, atlasPool } from '../db';

async function ensureLiveTable(table: string) {
  await atlasPool.query(`CREATE TABLE IF NOT EXISTS \`${table}\` (
    \`id\` int NOT NULL,
    \`timesheet_id\` int NOT NULL,
    \`name\` varchar(50) NOT NULL,
    \`value\` text,
    \`visible\` tinyint(1) NOT NULL DEFAULT 0,
    \`synced_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(\`id\`),
    INDEX \`ix_rktm_timesheet\` (\`timesheet_id\`),
    INDEX \`ix_rktm_name\` (\`name\`)
  )`);
}

async function createStaging(live: string, stg: string) {
  await atlasPool.query(`DROP TABLE IF EXISTS \`${stg}\``);
  await atlasPool.query(`CREATE TABLE \`${stg}\` LIKE \`${live}\``);
}

async function insertBatch(table: string, rows: any[]) {
  if (!rows.length) return;
  const cols = ['id', 'timesheet_id', 'name', 'value', 'visible'];
  const ph = '(' + cols.map(() => '?').join(',') + ')';
  const values: any[] = [];
  for (const r of rows) values.push(r.id, r.timesheet_id, r.name, r.value, r.visible);
  const sql = `INSERT INTO \`${table}\` (${cols.join(',')}) VALUES ${rows.map(() => ph).join(',')}`;
  await atlasPool.query(sql, values);
}

async function swapTables(live: string, stg: string) {
  const old = `${live}_old`;
  await atlasPool.query(`RENAME TABLE \`${live}\` TO \`${old}\`, \`${stg}\` TO \`${live}\``);
  await atlasPool.query(`DROP TABLE IF EXISTS \`${old}\``);
}

async function main() {
  console.log('[sync:timesheet_meta] Full refresh (staging-and-swap)');
  const live = 'replica_kimai_timesheet_meta';
  const stg = 'replica_kimai_timesheet_meta_stg';
  await ensureLiveTable(live);
  await createStaging(live, stg);

  const [rows]: any = await kimaiPool.query(
    'SELECT id, timesheet_id, name, value, visible FROM kimai2_timesheet_meta'
  );
  await insertBatch(stg, rows);
  await swapTables(live, stg);
  console.log(`[sync:timesheet_meta] Swap complete. Rows: ${rows.length}`);

  await atlasPool.query(
    'INSERT INTO sync_state (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value=VALUES(state_value), updated_at=CURRENT_TIMESTAMP',
    ['sync.tsmeta.last_run', new Date().toISOString()]
  );

  await kimaiPool.end();
  await atlasPool.end();
}

main().catch((e) => {
  console.error('[sync:timesheet_meta] Failed:', e?.message || e);
  process.exit(1);
});

