import 'dotenv/config';
import { kimaiPool, atlasPool } from '../db';

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
  console.log('[sync:timesheets] Starting incremental sync from Kimai');
  const checkpoint = await getCheckpoint();
  const now = new Date();
  let whereSql = '';
  let params: any[] = [];
  if (checkpoint) {
    const since = minusMinutes(checkpoint, OVERLAP_MINUTES);
    whereSql = 'WHERE modified_at IS NOT NULL AND modified_at > ?';
    params = [since];
    console.log('[sync:timesheets] Using checkpoint since', since.toISOString());
  } else {
    // Bootstrap: include rows with modified_at NULL in a reasonable window and rows with modified_at >= initialSince
    whereSql = 'WHERE (modified_at IS NULL AND start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)) OR (modified_at IS NOT NULL AND modified_at >= DATE_SUB(NOW(), INTERVAL ? DAY))';
    params = [INITIAL_DAYS, INITIAL_DAYS];
    console.log('[sync:timesheets] Bootstrap mode for last', INITIAL_DAYS, 'days');
  }

  let offset = 0;
  let total = 0;
  let maxModified: Date | null = checkpoint || null;
  for (;;) {
    const rows = await fetchBatch(whereSql, params, offset, BATCH);
    if (!rows.length) break;
    await upsertBatch(rows);
    total += rows.length;
    offset += rows.length;
    for (const r of rows) {
      if (r.modified_at) {
        const d = new Date(r.modified_at);
        if (!maxModified || d > maxModified) maxModified = d;
      }
    }
    console.log(`[sync:timesheets] Upserted ${total}`);
    if (rows.length < BATCH) break;
  }
  // Fallback: if bootstrap window yielded no rows (e.g., historical DB), perform a one-time full load
  if (!checkpoint && total === 0) {
    console.log('[sync:timesheets] Bootstrap window returned 0 rows; falling back to one-time full load');
    offset = 0;
    for (;;) {
      const allRows = await fetchAllBatch(offset, BATCH);
      if (!allRows.length) break;
      await upsertBatch(allRows);
      total += allRows.length;
      // No modified_at checkpoint advancement on full load if missing; still compute max if present
      for (const r of allRows) {
        if (r.modified_at) {
          const d = new Date(r.modified_at);
          if (!maxModified || d > maxModified) maxModified = d;
        }
      }
      offset += allRows.length;
      console.log(`[sync:timesheets] Full-load upserted ${total}`);
    }
  }
  if (maxModified) {
    await setCheckpoint(maxModified);
    console.log('[sync:timesheets] Updated checkpoint to', maxModified.toISOString());
  } else {
    console.log('[sync:timesheets] No checkpoint update (no modified rows)');
  }
  // Reconcile deletes within rolling window
  try {
    const [kRows]: any = await kimaiPool.query(
      'SELECT id FROM kimai2_timesheet WHERE date_tz >= DATE_SUB(CURDATE(), INTERVAL ? DAY)',
      [RECONCILE_DAYS]
    );
    const kimaiSet = new Set<number>(kRows.map((r: any) => Number(r.id)));
    const [rRows]: any = await atlasPool.query(
      'SELECT id FROM replica_kimai_timesheets WHERE date_tz >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ? DAY), "%Y-%m-%d")',
      [RECONCILE_DAYS]
    );
    const missing: number[] = [];
    for (const r of rRows) {
      const id = Number(r.id);
      if (!kimaiSet.has(id)) missing.push(id);
    }
    if (missing.length) {
      console.log(`[sync:timesheets] Reconciling deletes in last ${RECONCILE_DAYS}d: ${missing.length} rows`);
      for (let i = 0; i < missing.length; i += DELETE_CHUNK) {
        const chunk = missing.slice(i, i + DELETE_CHUNK);
        const placeholders = chunk.map(() => '?').join(',');
        await atlasPool.query(`DELETE FROM replica_kimai_timesheets WHERE id IN (${placeholders})`, chunk);
      }
    } else {
      console.log('[sync:timesheets] No deletions to reconcile in rolling window');
    }
  } catch (e: any) {
    console.warn('[sync:timesheets] Reconciliation skipped:', e?.message || e);
  }
  await kimaiPool.end();
  await atlasPool.end();
  console.log('[sync:timesheets] Done');
}

main().catch((e) => {
  console.error('[sync:timesheets] Failed:', e?.message || e);
  process.exit(1);
});
