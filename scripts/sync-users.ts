import 'dotenv/config';
import { kimaiPool, atlasPool } from '../db';

async function createStaging(live: string, stg: string) {
  await atlasPool.query(`DROP TABLE IF EXISTS \`${stg}\``);
  await atlasPool.query(`CREATE TABLE \`${stg}\` LIKE \`${live}\``);
}

async function insertBatch(table: string, rows: any[]) {
  if (!rows.length) return;
  const cols = ['id','username','alias','email','enabled','color','account','system_account','supervisor_id','timezone'];
  const ph = '(' + cols.map(() => '?').join(',') + ')';
  const values: any[] = [];
  for (const r of rows) values.push(r.id, r.username, r.alias ?? null, r.email, r.enabled, r.color, r.account, r.system_account, r.supervisor_id, null);
  const sql = `INSERT INTO \`${table}\` (${cols.join(',')}) VALUES ${rows.map(() => ph).join(',')}`;
  await atlasPool.query(sql, values);
}

async function swapTables(live: string, stg: string) {
  const old = `${live}_old`;
  await atlasPool.query(`RENAME TABLE \`${live}\` TO \`${old}\`, \`${stg}\` TO \`${live}\``);
  await atlasPool.query(`DROP TABLE IF EXISTS \`${old}\``);
}

async function main() {
  console.log('[sync:users] Full refresh (staging-and-swap)');
  const live = 'replica_kimai_users';
  const stg = 'replica_kimai_users_stg';
  await createStaging(live, stg);
  const [rows]: any = await kimaiPool.query('SELECT id, username, alias, email, enabled, color, account, system_account, supervisor_id FROM kimai2_users');
  await insertBatch(stg, rows);
  await swapTables(live, stg);
  console.log(`[sync:users] Swap complete. Rows: ${rows.length}`);
  await atlasPool.query(
    'INSERT INTO sync_state (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value=VALUES(state_value), updated_at=CURRENT_TIMESTAMP',
    ['sync.users.last_run', new Date().toISOString()]
  );
  await kimaiPool.end();
  await atlasPool.end();
}

main().catch((e) => { console.error('[sync:users] Failed:', e?.message || e); process.exit(1); });
