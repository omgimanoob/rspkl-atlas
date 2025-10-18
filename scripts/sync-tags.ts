import 'dotenv/config';
import { kimaiPool, atlasPool } from '../db';

async function createStaging(live: string, stg: string) {
  await atlasPool.query(`DROP TABLE IF EXISTS \`${stg}\``);
  await atlasPool.query(`CREATE TABLE \`${stg}\` LIKE \`${live}\``);
}

async function upsertTags(table: string, rows: any[]) {
  if (!rows.length) return;
  const cols = ['id','name','color'];
  const ph = '(' + cols.map(() => '?').join(',') + ')';
  const values: any[] = [];
  for (const r of rows) values.push(r.id, r.name, r.color);
  const sql = `INSERT INTO \`${table}\` (${cols.join(',')}) VALUES ${rows.map(() => ph).join(',')}`;
  await atlasPool.query(sql, values);
}

async function upsertTimesheetTags(table: string, rows: any[]) {
  if (!rows.length) return;
  const cols = ['timesheet_id','tag_id'];
  const ph = '(' + cols.map(() => '?').join(',') + ')';
  const values: any[] = [];
  for (const r of rows) values.push(r.timesheet_id, r.tag_id);
  const sql = `INSERT INTO \`${table}\` (${cols.join(',')}) VALUES ${rows.map(() => ph).join(',')}`;
  await atlasPool.query(sql, values);
}

async function swapTables(live: string, stg: string) {
  const old = `${live}_old`;
  await atlasPool.query(`RENAME TABLE \`${live}\` TO \`${old}\`, \`${stg}\` TO \`${live}\``);
  await atlasPool.query(`DROP TABLE IF EXISTS \`${old}\``);
}

async function main() {
  console.log('[sync:tags] Full refresh (staging-and-swap) for tags and timesheet_tags');
  // Tags
  const liveTags = 'replica_kimai_tags';
  const stgTags = 'replica_kimai_tags_stg';
  await createStaging(liveTags, stgTags);
  const [tags]: any = await kimaiPool.query('SELECT id, name, color FROM kimai2_tags');
  await upsertTags(stgTags, tags);
  await swapTables(liveTags, stgTags);
  console.log(`[sync:tags] Tags swapped. Rows: ${tags.length}`);
  // Timesheet tags
  const liveTt = 'replica_kimai_timesheet_tags';
  const stgTt = 'replica_kimai_timesheet_tags_stg';
  await createStaging(liveTt, stgTt);
  const [tsTags]: any = await kimaiPool.query('SELECT timesheet_id, tag_id FROM kimai2_timesheet_tags');
  await upsertTimesheetTags(stgTt, tsTags);
  await swapTables(liveTt, stgTt);
  console.log(`[sync:tags] Timesheet tags swapped. Rows: ${tsTags.length}`);
  await atlasPool.query(
    'INSERT INTO sync_state (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value=VALUES(state_value), updated_at=CURRENT_TIMESTAMP',
    ['sync.tags.last_run', new Date().toISOString()]
  );
  await kimaiPool.end();
  await atlasPool.end();
}

main().catch((e) => { console.error('[sync:tags] Failed:', e?.message || e); process.exit(1); });
