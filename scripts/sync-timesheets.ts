import 'dotenv/config';
import { kimaiPool, atlasPool } from '../db';
import { syncTimesheetsShared } from '../src/services/timesheetsSync';

const BATCH = 2000;
const INITIAL_DAYS = 90; // initial bootstrap window for null modified_at rows
const OVERLAP_MINUTES = 5; // overlap window for safety
const RECONCILE_DAYS = Number(process.env.SYNC_TS_RECONCILE_DAYS || 30);
const DELETE_CHUNK = 1000;

async function getCheckpoint(): Promise<Date | null> {
  const [rows]: any = await atlasPool.query('SELECT state_value FROM sync_state WHERE state_key = ? LIMIT 1', [
    'kimai.timesheets.last_modified_at',
  ]);
  const v = rows?.[0]?.state_value as string | undefined;
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

async function setCheckpoint(d: Date) {
  await atlasPool.query(
    'INSERT INTO sync_state (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value=VALUES(state_value), updated_at=CURRENT_TIMESTAMP',
    ['kimai.timesheets.last_modified_at', d.toISOString()]
  );
}

function minusMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() - minutes * 60_000);
}

async function fetchBatch(whereSql: string, params: any[], offset: number, limit: number) {
  const sql = `SELECT id, ` +
    '`user`, activity_id, project_id, start_time, end_time, duration, LEFT(description,191) AS description, ' +
    'rate, fixed_rate, hourly_rate, exported, timezone, internal_rate, billable, category, modified_at, DATE_FORMAT(date_tz, "%Y-%m-%d") AS date_tz ' +
    'FROM kimai2_timesheet ' + whereSql + ' ORDER BY modified_at ASC, id ASC LIMIT ? OFFSET ?';
  const [rows]: any = await kimaiPool.query(sql, [...params, limit, offset]);
  return rows;
}

async function fetchAllBatch(offset: number, limit: number) {
  const sql = `SELECT id, ` +
    '`user`, activity_id, project_id, start_time, end_time, duration, LEFT(description,191) AS description, ' +
    'rate, fixed_rate, hourly_rate, exported, timezone, internal_rate, billable, category, modified_at, DATE_FORMAT(date_tz, "%Y-%m-%d") AS date_tz ' +
    'FROM kimai2_timesheet ORDER BY id ASC LIMIT ? OFFSET ?';
  const [rows]: any = await kimaiPool.query(sql, [limit, offset]);
  return rows;
}

async function upsertBatch(rows: any[]) {
  if (rows.length === 0) return;
  const cols = [
    'id','user','activity_id','project_id','start_time','end_time','duration','description','rate','fixed_rate','hourly_rate','exported','timezone','internal_rate','billable','category','modified_at','date_tz'
  ];
  const placeholders = '(' + cols.map(() => '?').join(',') + ')';
  const values: any[] = [];
  for (const r of rows) {
    values.push(
      r.id,
      r.user,
      r.activity_id,
      r.project_id,
      r.start_time,
      r.end_time,
      r.duration,
      r.description,
      r.rate,
      r.fixed_rate,
      r.hourly_rate,
      r.exported,
      r.timezone,
      r.internal_rate,
      r.billable,
      r.category,
      r.modified_at,
      r.date_tz
    );
  }
  const sql = `INSERT INTO replica_kimai_timesheets (${cols.join(',')}) VALUES ${rows
    .map(() => placeholders)
    .join(',')} ON DUPLICATE KEY UPDATE 
    user=VALUES(user), activity_id=VALUES(activity_id), project_id=VALUES(project_id), start_time=VALUES(start_time), end_time=VALUES(end_time),
    duration=VALUES(duration), description=VALUES(description), rate=VALUES(rate), fixed_rate=VALUES(fixed_rate), hourly_rate=VALUES(hourly_rate),
    exported=VALUES(exported), timezone=VALUES(timezone), internal_rate=VALUES(internal_rate), billable=VALUES(billable), category=VALUES(category),
    modified_at=VALUES(modified_at), date_tz=VALUES(date_tz), synced_at=CURRENT_TIMESTAMP`;
  await atlasPool.query(sql, values);
}

async function main() {
  console.log('[sync:timesheets] Starting sync (shared service)');
  const { total, newRows, maxModified } = await syncTimesheetsShared({
    atlasPool,
    kimaiPool,
    batch: BATCH,
    initialDays: INITIAL_DAYS,
    overlapMinutes: OVERLAP_MINUTES,
    reconcileDays: RECONCILE_DAYS,
  })
  console.log(`[sync:timesheets] Upserted ${total}${newRows ? ` (new: ${newRows})` : ''}`)
  // Record last_run so the dashboard reflects CLI runs too
  try {
    await atlasPool.query(
      'INSERT INTO sync_state (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value=VALUES(state_value), updated_at=CURRENT_TIMESTAMP',
      ['sync.timesheets.last_run', new Date().toISOString()]
    );
  } catch {}
  await kimaiPool.end();
  await atlasPool.end();
  console.log('[sync:timesheets] Done');
}

main().catch((e) => {
  console.error('[sync:timesheets] Failed:', e?.message || e);
  process.exit(1);
});
