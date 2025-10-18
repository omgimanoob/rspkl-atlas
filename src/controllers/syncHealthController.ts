import { atlasPool } from '../../db';

export async function syncHealthHandler(_req, res) {
  try {
    const keys = [
      'sync.projects.last_run',
      'sync.timesheets.last_modified_at',
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
    const countsSql = `SELECT 'projects' as name, COUNT(*) as cnt FROM replica_kimai_projects
      UNION ALL SELECT 'timesheets', COUNT(*) FROM replica_kimai_timesheets
      UNION ALL SELECT 'users', COUNT(*) FROM replica_kimai_users
      UNION ALL SELECT 'activities', COUNT(*) FROM replica_kimai_activities
      UNION ALL SELECT 'tags', COUNT(*) FROM replica_kimai_tags
      UNION ALL SELECT 'timesheet_tags', COUNT(*) FROM replica_kimai_timesheet_tags
      UNION ALL SELECT 'customers', COUNT(*) FROM replica_kimai_customers`;
    const [countRows]: any = await atlasPool.query(countsSql);
    const counts: Record<string, number> = {};
    for (const r of countRows) counts[r.name] = Number(r.cnt) || 0;
    res.json({ state, counts });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to read sync health', detail: e?.message || String(e) });
  }
}

