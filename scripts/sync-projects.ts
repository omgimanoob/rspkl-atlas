import 'dotenv/config';
import { kimaiPool, atlasPool } from '../db';

async function createStaging(live: string, stg: string) {
  await atlasPool.query(`DROP TABLE IF EXISTS \`${stg}\``);
  await atlasPool.query(`CREATE TABLE \`${stg}\` LIKE \`${live}\``);
}

async function insertBatch(table: string, rows: any[]) {
  if (rows.length === 0) return;
  const cols = [
    'id','customer_id','name','visible','budget','color','time_budget','order_date','start','end','timezone','budget_type','billable'
  ];
  const placeholders = '(' + cols.map(() => '?').join(',') + ')';
  const values: any[] = [];
  for (const r of rows) {
    values.push(
      r.id,
      r.customer_id,
      r.name,
      r.visible,
      r.budget,
      r.color,
      r.time_budget,
      r.order_date,
      r.start,
      r.end,
      r.timezone,
      r.budget_type,
      r.billable
    );
  }
  const sql = `INSERT INTO \`${table}\` (${cols.join(',')}) VALUES ${rows.map(() => placeholders).join(',')}`;
  await atlasPool.query(sql, values);
}

async function swapTables(live: string, stg: string) {
  const old = `${live}_old`;
  await atlasPool.query(`RENAME TABLE \`${live}\` TO \`${old}\`, \`${stg}\` TO \`${live}\``);
  await atlasPool.query(`DROP TABLE IF EXISTS \`${old}\``);
}

async function main() {
  console.log('[sync:projects] Starting full refresh (staging-and-swap)');
  const batchSize = 2000;
  let offset = 0;
  let total = 0;
  const live = 'replica_kimai_projects';
  const stg = 'replica_kimai_projects_stg';
  await createStaging(live, stg);
  for (;;) {
    const [rows]: any = await kimaiPool.query(
      'SELECT id, customer_id, name, visible, budget, color, time_budget, order_date, start, end, timezone, budget_type, billable FROM kimai2_projects ORDER BY id LIMIT ? OFFSET ?',
      [batchSize, offset]
    );
    if (!rows.length) break;
    await insertBatch(stg, rows);
    total += rows.length;
    offset += rows.length;
    console.log(`[sync:projects] Upserted ${total}`);
  }
  await swapTables(live, stg);
  console.log('[sync:projects] Swap complete. Done');
  // record sync state
  await atlasPool.query(
    'INSERT INTO sync_state (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value=VALUES(state_value), updated_at=CURRENT_TIMESTAMP',
    ['sync.projects.last_run', new Date().toISOString()]
  );
  await kimaiPool.end();
  await atlasPool.end();
}

main().catch((e) => {
  console.error('[sync:projects] Failed:', e?.message || e);
  process.exit(1);
});
