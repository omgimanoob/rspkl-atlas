import { Pool } from 'mysql2/promise'

type Options = {
  atlasPool: Pool
  kimaiPool: Pool
  batch?: number
  initialDays?: number
  overlapMinutes?: number
  reconcileDays?: number
}

export async function syncTimesheetsShared(opts: Options): Promise<{ total: number; newRows: number; maxModified: Date | null }> {
  const BATCH = opts.batch ?? 2000
  const INITIAL_DAYS = opts.initialDays ?? 90
  const OVERLAP_MINUTES = opts.overlapMinutes ?? 5
  const RECONCILE_DAYS = opts.reconcileDays ?? 30
  const atlasPool = opts.atlasPool
  const kimaiPool = opts.kimaiPool

  async function getCheckpoint(): Promise<Date | null> {
    const [rows]: any = await atlasPool.query('SELECT state_value FROM sync_state WHERE state_key = ? LIMIT 1', [
      'kimai.timesheets.last_modified_at',
    ])
    const v = rows?.[0]?.state_value as string | undefined
    if (!v) return null
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d
  }
  async function setCheckpoint(d: Date) {
    await atlasPool.query(
      'INSERT INTO sync_state (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value=VALUES(state_value), updated_at=CURRENT_TIMESTAMP',
      ['kimai.timesheets.last_modified_at', d.toISOString()]
    )
  }
  function minusMinutes(d: Date, minutes: number): Date { return new Date(d.getTime() - minutes * 60_000) }
  async function fetchBatch(whereSql: string, params: any[], offset: number, limit: number) {
    const sql = `SELECT id, ` +
      '`user`, activity_id, project_id, start_time, end_time, duration, LEFT(description,191) AS description, ' +
      'rate, fixed_rate, hourly_rate, exported, timezone, internal_rate, billable, category, modified_at, DATE_FORMAT(date_tz, "%Y-%m-%d") AS date_tz ' +
      'FROM kimai2_timesheet ' + whereSql + ' ORDER BY modified_at ASC, id ASC LIMIT ? OFFSET ?'
    const [rows]: any = await kimaiPool.query(sql, [...params, limit, offset])
    return rows as any[]
  }
  async function fetchAllBatch(offset: number, limit: number) {
    const sql = `SELECT id, ` +
      '`user`, activity_id, project_id, start_time, end_time, duration, LEFT(description,191) AS description, ' +
      'rate, fixed_rate, hourly_rate, exported, timezone, internal_rate, billable, category, modified_at, DATE_FORMAT(date_tz, "%Y-%m-%d") AS date_tz ' +
      'FROM kimai2_timesheet ORDER BY id ASC LIMIT ? OFFSET ?'
    const [rows]: any = await kimaiPool.query(sql, [limit, offset])
    return rows as any[]
  }
  async function upsertBatch(rows: any[]) {
    if (rows.length === 0) return
    const cols = [
      'id','user','activity_id','project_id','start_time','end_time','duration','description','rate','fixed_rate','hourly_rate','exported','timezone','internal_rate','billable','category','modified_at','date_tz'
    ]
    const placeholders = '(' + cols.map(() => '?').join(',') + ')'
    const values: any[] = []
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
      )
    }
    await atlasPool.query(
      `INSERT INTO replica_kimai_timesheets (${cols.join(',')}) VALUES ${rows.map(() => placeholders).join(',')} \
ON DUPLICATE KEY UPDATE \
user=VALUES(user), activity_id=VALUES(activity_id), project_id=VALUES(project_id), start_time=VALUES(start_time), end_time=VALUES(end_time), \
duration=VALUES(duration), description=VALUES(description), rate=VALUES(rate), fixed_rate=VALUES(fixed_rate), hourly_rate=VALUES(hourly_rate), \
exported=VALUES(exported), timezone=VALUES(timezone), internal_rate=VALUES(internal_rate), billable=VALUES(billable), category=VALUES(category), \
modified_at=VALUES(modified_at), date_tz=VALUES(date_tz), synced_at=CURRENT_TIMESTAMP`,
      values
    )
  }

  const checkpoint = await getCheckpoint()
  const [repCntRows]: any = await atlasPool.query('SELECT COUNT(*) AS cnt FROM `replica_kimai_timesheets`')
  const replicaEmpty = Number(repCntRows?.[0]?.cnt || 0) === 0

  let total = 0
  let newRows = 0
  let maxModified: Date | null = checkpoint || null

  if (replicaEmpty) {
    // One-time full load
    let offset = 0
    for (;;) {
      const rows = await fetchAllBatch(offset, BATCH)
      if (!rows.length) break
      await upsertBatch(rows)
      total += rows.length
      for (const r of rows) {
        if (r.modified_at) {
          const d = new Date(r.modified_at)
          if (!maxModified || d > maxModified) maxModified = d
        }
      }
      offset += rows.length
    }
  } else {
    // Incremental window
    let whereSql = ''
    let params: any[] = []
    if (checkpoint) {
      const since = minusMinutes(checkpoint, OVERLAP_MINUTES)
      whereSql = 'WHERE modified_at IS NOT NULL AND modified_at > ?'
      params = [since]
    } else {
      whereSql = 'WHERE (modified_at IS NULL AND start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)) OR (modified_at IS NOT NULL AND modified_at >= DATE_SUB(NOW(), INTERVAL ? DAY))'
      params = [INITIAL_DAYS, INITIAL_DAYS]
    }
    let offset = 0
    for (;;) {
      const rows = await fetchBatch(whereSql, params, offset, BATCH)
      if (!rows.length) break
      await upsertBatch(rows)
      total += rows.length
      offset += rows.length
      for (const r of rows) {
        if (r.modified_at) {
          const d = new Date(r.modified_at)
          if (!maxModified || d > maxModified) maxModified = d
          if (checkpoint && d > checkpoint) newRows += 1
        }
      }
      if (rows.length < BATCH) break
    }
    // Bootstrap fallback (optional)
    if (!checkpoint && total === 0) {
      let off = 0
      for (;;) {
        const allRows = await fetchAllBatch(off, BATCH)
        if (!allRows.length) break
        await upsertBatch(allRows)
        total += allRows.length
        for (const r of allRows) {
          if (r.modified_at) {
            const d = new Date(r.modified_at)
            if (!maxModified || d > maxModified) maxModified = d
          }
        }
        off += allRows.length
      }
    }
  }

  if (maxModified) await setCheckpoint(maxModified)

  // Reconcile deletes within rolling window
  try {
    const [kRows]: any = await kimaiPool.query(
      'SELECT id FROM kimai2_timesheet WHERE date_tz >= DATE_SUB(CURDATE(), INTERVAL ? DAY)',
      [RECONCILE_DAYS]
    )
    const kimaiSet = new Set<number>(kRows.map((r: any) => Number(r.id)))
    const [rRows]: any = await atlasPool.query(
      'SELECT id FROM replica_kimai_timesheets WHERE date_tz >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ? DAY), "%Y-%m-%d")',
      [RECONCILE_DAYS]
    )
    const missing: number[] = []
    for (const r of rRows) {
      const id = Number(r.id)
      if (!kimaiSet.has(id)) missing.push(id)
    }
    if (missing.length) {
      for (let i = 0; i < missing.length; i += 1000) {
        const chunk = missing.slice(i, i + 1000)
        const placeholders = chunk.map(() => '?').join(',')
        await atlasPool.query(`DELETE FROM replica_kimai_timesheets WHERE id IN (${placeholders})`, chunk)
      }
    }
  } catch {}

  return { total, newRows, maxModified }
}

