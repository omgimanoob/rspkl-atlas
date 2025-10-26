import { atlasPool } from '../../db';
import { kimaiPool } from '../../db';

export async function syncHealthHandler(_req, res) {
  try {
    const keys = [
      'sync.projects.last_run',
      'sync.timesheets.last_run',
      'sync.timesheets.last_modified_at',
      'sync.tsmeta.last_run',
      'sync.customers.last_run',
      'sync.users.last_run',
      'sync.activities.last_run',
      'sync.tags.last_run',
    ];
    const [stateRows]: any = await atlasPool.query(
      `SELECT state_key, state_value, updated_at FROM sync_state WHERE state_key IN (${keys.map(() => '?').join(',')})`,
      keys
    );
    const state: Record<string, any> = {};
    for (const r of stateRows) state[r.state_key] = { value: r.state_value, updated_at: r.updated_at };
    // Build counts and last-modified per replica table (tolerant of missing tables)
    const tables: Record<string, string> = {
      projects: 'replica_kimai_projects',
      timesheets: 'replica_kimai_timesheets',
      users: 'replica_kimai_users',
      activities: 'replica_kimai_activities',
      tags: 'replica_kimai_tags',
      timesheet_tags: 'replica_kimai_timesheet_tags',
      timesheet_meta: 'replica_kimai_timesheet_meta',
      customers: 'replica_kimai_customers',
    };
    const counts: Record<string, number> = {};
    const replicaLast: Record<string, string | null> = {};
    for (const [name, table] of Object.entries(tables)) {
      try {
        const [existsRows]: any = await atlasPool.query(
          'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1',
          [table]
        );
        const exists = Array.isArray(existsRows) && existsRows.length > 0;
        if (!exists) {
          counts[name] = 0;
          replicaLast[name] = null;
          continue;
        }
        const [cRows]: any = await atlasPool.query(`SELECT COUNT(*) AS cnt, MAX(synced_at) AS last FROM \`${table}\``);
        counts[name] = Number(cRows?.[0]?.cnt || 0);
        const lastVal = cRows?.[0]?.last;
        replicaLast[name] = lastVal ? new Date(lastVal).toISOString() : null;
      } catch {
        counts[name] = 0;
        replicaLast[name] = null;
      }
    }
    res.json({ state, counts, replicaLast });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to read sync health', detail: e?.message || String(e) });
  }
}

type Summary = { name: string; kimai: number; replica: number; diff: number; ok: boolean }

async function countOne(pool: any, sql: string, params: any[] = []): Promise<number> {
  const [rows]: any = await pool.query(sql, params)
  const v = rows?.[0]?.cnt
  return Number(v) || 0
}

function withinTolerance(kimai: number, replica: number, tolerance: number): boolean {
  if (kimai === 0) return replica === 0
  const rel = Math.abs(replica - kimai) / kimai
  return rel <= tolerance
}

export async function syncVerifyHandler(_req, res) {
  try {
    const WINDOW_DAYS = Number(process.env.QUALITY_WINDOW_DAYS || 7)
    const TOLERANCE = Number(process.env.QUALITY_TOLERANCE || 0.02)
    const totals: Summary[] = []
    // Projects
    const kProjects = await countOne(kimaiPool, 'SELECT COUNT(*) AS cnt FROM kimai2_projects')
    const rProjects = await countOne(atlasPool, 'SELECT COUNT(*) AS cnt FROM replica_kimai_projects')
    totals.push({ name: 'projects', kimai: kProjects, replica: rProjects, diff: rProjects - kProjects, ok: withinTolerance(kProjects, rProjects, TOLERANCE) })
    // Users
    const kUsers = await countOne(kimaiPool, 'SELECT COUNT(*) AS cnt FROM kimai2_users')
    const rUsers = await countOne(atlasPool, 'SELECT COUNT(*) AS cnt FROM replica_kimai_users')
    totals.push({ name: 'users', kimai: kUsers, replica: rUsers, diff: rUsers - kUsers, ok: withinTolerance(kUsers, rUsers, TOLERANCE) })
    // Activities
    const kActs = await countOne(kimaiPool, 'SELECT COUNT(*) AS cnt FROM kimai2_activities')
    const rActs = await countOne(atlasPool, 'SELECT COUNT(*) AS cnt FROM replica_kimai_activities')
    totals.push({ name: 'activities', kimai: kActs, replica: rActs, diff: rActs - kActs, ok: withinTolerance(kActs, rActs, TOLERANCE) })
    // Customers
    const kCust = await countOne(kimaiPool, 'SELECT COUNT(*) AS cnt FROM kimai2_customers')
    const rCust = await countOne(atlasPool, 'SELECT COUNT(*) AS cnt FROM replica_kimai_customers')
    totals.push({ name: 'customers', kimai: kCust, replica: rCust, diff: rCust - kCust, ok: withinTolerance(kCust, rCust, TOLERANCE) })
    // Tags (total)
    const kTags = await countOne(kimaiPool, 'SELECT COUNT(*) AS cnt FROM kimai2_tags')
    const rTags = await countOne(atlasPool, 'SELECT COUNT(*) AS cnt FROM replica_kimai_tags')
    totals.push({ name: 'tags', kimai: kTags, replica: rTags, diff: rTags - kTags, ok: withinTolerance(kTags, rTags, TOLERANCE) })
    // Timesheet meta (total)
    const kTsMeta = await countOne(kimaiPool, 'SELECT COUNT(*) AS cnt FROM kimai2_timesheet_meta')
    const rTsMeta = await countOne(atlasPool, 'SELECT COUNT(*) AS cnt FROM replica_kimai_timesheet_meta')
    totals.push({ name: 'timesheet_meta', kimai: kTsMeta, replica: rTsMeta, diff: rTsMeta - kTsMeta, ok: withinTolerance(kTsMeta, rTsMeta, TOLERANCE) })
    // Timesheets (total)
    const kTs = await countOne(kimaiPool, 'SELECT COUNT(*) AS cnt FROM kimai2_timesheet')
    const rTs = await countOne(atlasPool, 'SELECT COUNT(*) AS cnt FROM replica_kimai_timesheets')
    totals.push({ name: 'timesheets', kimai: kTs, replica: rTs, diff: rTs - kTs, ok: withinTolerance(kTs, rTs, TOLERANCE) })

    // Recent window for timesheets
    const kRecent = await countOne(
      kimaiPool,
      'SELECT COUNT(*) AS cnt FROM kimai2_timesheet WHERE date_tz >= DATE_SUB(CURDATE(), INTERVAL ? DAY)',
      [WINDOW_DAYS]
    )
    const rRecent = await countOne(
      atlasPool,
      'SELECT COUNT(*) AS cnt FROM replica_kimai_timesheets WHERE date_tz >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ? DAY), "%Y-%m-%d")',
      [WINDOW_DAYS]
    )
    const recent = { days: WINDOW_DAYS, kimai: kRecent, replica: rRecent, diff: rRecent - kRecent, ok: withinTolerance(kRecent, rRecent, TOLERANCE) }

    res.json({ totals, recent, tolerance: TOLERANCE })
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to verify sync', detail: e?.message || String(e) })
  }
}
