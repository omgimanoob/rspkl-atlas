import 'dotenv/config';
import { kimaiPool, atlasPool } from '../db';

async function createStaging(live: string, stg: string) {
  await atlasPool.query(`DROP TABLE IF EXISTS \`${stg}\``);
  await atlasPool.query(`CREATE TABLE \`${stg}\` LIKE \`${live}\``);
}

async function insertBatch(table: string, rows: any[]) {
  if (!rows.length) return;
  const cols = ['id','project_id','name','visible','billable','time_budget','budget'];
  const ph = '(' + cols.map(() => '?').join(',') + ')';
  const values: any[] = [];
  for (const r of rows) values.push(r.id, r.project_id, r.name, r.visible, r.billable, r.time_budget, r.budget);
  const sql = `INSERT INTO \`${table}\` (${cols.join(',')}) VALUES ${rows.map(() => ph).join(',')}`;
  await atlasPool.query(sql, values);
}

async function swapTables(live: string, stg: string) {
  const old = `${live}_old`;
  await atlasPool.query(`RENAME TABLE \`${live}\` TO \`${old}\`, \`${stg}\` TO \`${live}\``);
  await atlasPool.query(`DROP TABLE IF EXISTS \`${old}\``);
}

async function main() {
  console.log('[sync:activities] Full refresh (staging-and-swap)');
  const live = 'replica_kimai_activities';
  const stg = 'replica_kimai_activities_stg';
  await createStaging(live, stg);
  const [rows]: any = await kimaiPool.query('SELECT id, project_id, name, visible, billable, time_budget, budget FROM kimai2_activities');
  await insertBatch(stg, rows);
  await swapTables(live, stg);
  console.log(`[sync:activities] Swap complete. Rows: ${rows.length}`);
  await atlasPool.query(
    'INSERT INTO sync_state (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value=VALUES(state_value), updated_at=CURRENT_TIMESTAMP',
    ['sync.activities.last_run', new Date().toISOString()]
  );
  await kimaiPool.end();
  await atlasPool.end();
}

main().catch((e) => { console.error('[sync:activities] Failed:', e?.message || e); process.exit(1); });
