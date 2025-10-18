import 'dotenv/config';
import { kimaiPool, atlasPool } from '../db';

type Summary = { name: string; kimai: number; replica: number; diff: number; ok: boolean };

const WINDOW_DAYS = Number(process.env.QUALITY_WINDOW_DAYS || 7);
const TOLERANCE = Number(process.env.QUALITY_TOLERANCE || 0.02); // 2%

async function countOne(pool: any, sql: string, params: any[] = []): Promise<number> {
  const [rows]: any = await pool.query(sql, params);
  const v = rows?.[0]?.cnt ?? 0;
  return Number(v) || 0;
}

function withinTolerance(kimai: number, replica: number, tolerance: number): boolean {
  if (kimai === 0) return replica === 0; // exact when no data
  const rel = Math.abs(replica - kimai) / kimai;
  return rel <= tolerance;
}

async function totals(): Promise<Summary[]> {
  const out: Summary[] = [];
  // Projects
  const kProjects = await countOne(kimaiPool, 'SELECT COUNT(*) AS cnt FROM kimai2_projects');
  const rProjects = await countOne(atlasPool, 'SELECT COUNT(*) AS cnt FROM replica_kimai_projects');
  out.push({ name: 'projects_total', kimai: kProjects, replica: rProjects, diff: rProjects - kProjects, ok: withinTolerance(kProjects, rProjects, TOLERANCE) });
  // Users
  const kUsers = await countOne(kimaiPool, 'SELECT COUNT(*) AS cnt FROM kimai2_users');
  const rUsers = await countOne(atlasPool, 'SELECT COUNT(*) AS cnt FROM replica_kimai_users');
  out.push({ name: 'users_total', kimai: kUsers, replica: rUsers, diff: rUsers - kUsers, ok: withinTolerance(kUsers, rUsers, TOLERANCE) });
  // Activities
  const kActs = await countOne(kimaiPool, 'SELECT COUNT(*) AS cnt FROM kimai2_activities');
  const rActs = await countOne(atlasPool, 'SELECT COUNT(*) AS cnt FROM replica_kimai_activities');
  out.push({ name: 'activities_total', kimai: kActs, replica: rActs, diff: rActs - kActs, ok: withinTolerance(kActs, rActs, TOLERANCE) });
  // Timesheets (total)
  const kTs = await countOne(kimaiPool, 'SELECT COUNT(*) AS cnt FROM kimai2_timesheet');
  const rTs = await countOne(atlasPool, 'SELECT COUNT(*) AS cnt FROM replica_kimai_timesheets');
  out.push({ name: 'timesheets_total', kimai: kTs, replica: rTs, diff: rTs - kTs, ok: withinTolerance(kTs, rTs, TOLERANCE) });
  return out;
}

async function recentTimesheets(): Promise<Summary[]> {
  const out: Summary[] = [];
  // Count in window by date (kimai: date_tz exists as DATE column; use WHERE date_tz >= CURDATE() - INTERVAL WINDOW_DAYS DAY)
  const kRecent = await countOne(
    kimaiPool,
    'SELECT COUNT(*) AS cnt FROM kimai2_timesheet WHERE date_tz >= DATE_SUB(CURDATE(), INTERVAL ? DAY)',
    [WINDOW_DAYS]
  );
  const rRecent = await countOne(
    atlasPool,
    'SELECT COUNT(*) AS cnt FROM replica_kimai_timesheets WHERE date_tz >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ? DAY), "%Y-%m-%d")',
    [WINDOW_DAYS]
  );
  out.push({ name: `timesheets_last_${WINDOW_DAYS}d`, kimai: kRecent, replica: rRecent, diff: rRecent - kRecent, ok: withinTolerance(kRecent, rRecent, TOLERANCE) });
  return out;
}

async function perDayBreakdown(): Promise<void> {
  console.log(`\n[quality] Per-day breakdown last ${WINDOW_DAYS}d`);
  const [kRows]: any = await kimaiPool.query(
    'SELECT date_tz AS dt, COUNT(*) AS cnt FROM kimai2_timesheet WHERE date_tz >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY date_tz ORDER BY date_tz',
    [WINDOW_DAYS]
  );
  const [rRows]: any = await atlasPool.query(
    'SELECT date_tz AS dt, COUNT(*) AS cnt FROM replica_kimai_timesheets WHERE date_tz >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ? DAY), "%Y-%m-%d") GROUP BY date_tz ORDER BY date_tz',
    [WINDOW_DAYS]
  );
  const rMap = new Map<string, number>();
  for (const r of rRows) rMap.set(r.dt, Number(r.cnt) || 0);
  const lines = kRows.map((k: any) => {
    const kimaiCnt = Number(k.cnt) || 0;
    const repCnt = rMap.get(String(k.dt)) || 0;
    const ok = withinTolerance(kimaiCnt, repCnt, TOLERANCE);
    return { date: k.dt, kimai: kimaiCnt, replica: repCnt, diff: repCnt - kimaiCnt, ok };
  });
  console.table(lines);
}

async function main() {
  const totalsReport = await totals();
  console.log('[quality] Totals');
  console.table(totalsReport);
  const recentReport = await recentTimesheets();
  console.log('[quality] Recent window');
  console.table(recentReport);
  await perDayBreakdown();
  const allOk = [...totalsReport, ...recentReport].every((r) => r.ok);
  await kimaiPool.end();
  await atlasPool.end();
  if (!allOk) {
    console.error('[quality] Discrepancies exceed tolerance');
    process.exit(2);
  } else {
    console.log('[quality] OK within tolerance');
  }
}

main().catch((e) => {
  console.error('[quality] Failed:', e?.message || e);
  process.exit(1);
});

