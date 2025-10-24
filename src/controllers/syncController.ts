// import { TimesheetSync } from '../services/timesheetSync';
import crypto from 'crypto';
import { recordAudit } from '../services/audit';
import { kimaiPool, atlasPool } from '../../db';

export async function syncTimesheetsHandler(_req, res) {
  try {
    // Incremental sync into replica_kimai_timesheets (based on scripts/sync-timesheets.ts)
    const BATCH = 2000;
    const INITIAL_DAYS = 90;
    const OVERLAP_MINUTES = 5;
    const RECONCILE_DAYS = Number(process.env.SYNC_TS_RECONCILE_DAYS || 30);

    async function getCheckpoint(): Promise<Date | null> {
      const [rows]: any = await atlasPool.query('SELECT state_value FROM sync_state WHERE state_key = ? LIMIT 1', [
        'sync.timesheets.last_modified_at',
      ]);
      const v = rows?.[0]?.state_value as string | undefined;
      if (!v) return null;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    async function setCheckpoint(d: Date) {
      await atlasPool.query(
        'INSERT INTO sync_state (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value=VALUES(state_value), updated_at=CURRENT_TIMESTAMP',
        ['sync.timesheets.last_modified_at', d.toISOString()]
      );
    }
    function minusMinutes(d: Date, minutes: number): Date { return new Date(d.getTime() - minutes * 60_000) }
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
      await atlasPool.query(
        `INSERT INTO replica_kimai_timesheets (${cols.join(',')}) VALUES ${rows.map(() => placeholders).join(',')} \
ON DUPLICATE KEY UPDATE \
user=VALUES(user), activity_id=VALUES(activity_id), project_id=VALUES(project_id), start_time=VALUES(start_time), end_time=VALUES(end_time), \
duration=VALUES(duration), description=VALUES(description), rate=VALUES(rate), fixed_rate=VALUES(fixed_rate), hourly_rate=VALUES(hourly_rate), \
exported=VALUES(exported), timezone=VALUES(timezone), internal_rate=VALUES(internal_rate), billable=VALUES(billable), category=VALUES(category), \
modified_at=VALUES(modified_at), date_tz=VALUES(date_tz), synced_at=CURRENT_TIMESTAMP`,
        values
      );
    }

    const checkpoint = await getCheckpoint();
    const now = new Date();
    let whereSql = '';
    let params: any[] = [];
    if (checkpoint) {
      const since = minusMinutes(checkpoint, OVERLAP_MINUTES);
      whereSql = 'WHERE modified_at IS NOT NULL AND modified_at > ?';
      params = [since];
    } else {
      whereSql = 'WHERE (modified_at IS NULL AND start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)) OR (modified_at IS NOT NULL AND modified_at >= DATE_SUB(NOW(), INTERVAL ? DAY))';
      params = [INITIAL_DAYS, INITIAL_DAYS];
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
      if (rows.length < BATCH) break;
    }
    if (!checkpoint && total === 0) {
      offset = 0;
      for (;;) {
        const allRows = await fetchAllBatch(offset, BATCH);
        if (!allRows.length) break;
        await upsertBatch(allRows);
        total += allRows.length;
        for (const r of allRows) {
          if (r.modified_at) {
            const d = new Date(r.modified_at);
            if (!maxModified || d > maxModified) maxModified = d;
          }
        }
        offset += allRows.length;
      }
    }
    if (maxModified) await setCheckpoint(maxModified);
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
        for (let i = 0; i < missing.length; i += 1000) {
          const chunk = missing.slice(i, i + 1000);
          const placeholders = chunk.map(() => '?').join(',');
          await atlasPool.query(`DELETE FROM replica_kimai_timesheets WHERE id IN (${placeholders})`, chunk);
        }
      }
    } catch {}
    try {
      await atlasPool.query(
        'INSERT INTO sync_state (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value=VALUES(state_value), updated_at=CURRENT_TIMESTAMP',
        ['sync.timesheets.last_run', new Date().toISOString()]
      );
    } catch {}
    await recordAudit(_req as any, 200, crypto.createHash('sha256').update('syncTimesheets').digest('hex'));
    res.json({ message: `Timesheets synced: ${total}` });
  } catch (e: any) {
    console.error('[syncTimesheets] failed:', e?.message || e);
    res.status(500).json({ error: 'Sync timesheets failed' });
  }
}

export async function syncProjectsHandler(_req, res) {
  // staging-and-swap within the API for convenience
  const live = 'replica_kimai_projects';
  const stg = 'replica_kimai_projects_stg';
  try {
    await atlasPool.query(`DROP TABLE IF EXISTS \`${stg}\``);
    await atlasPool.query(`CREATE TABLE IF NOT EXISTS \`${live}\` (
      \`id\` int NOT NULL,
      \`customer_id\` int,
      \`name\` varchar(150),
      \`visible\` tinyint(1),
      \`budget\` varchar(64),
      \`color\` varchar(7),
      \`time_budget\` int,
      \`order_date\` datetime,
      \`start\` datetime,
      \`end\` datetime,
      \`timezone\` varchar(64),
      \`budget_type\` varchar(10),
      \`billable\` tinyint(1),
      \`synced_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(\`id\`)
    )`);
    await atlasPool.query(`CREATE TABLE \`${stg}\` LIKE \`${live}\``);
    const [rows]: any = await kimaiPool.query(
      'SELECT id, customer_id, name, visible, budget, color, time_budget, order_date, start, end, timezone, budget_type, billable FROM kimai2_projects ORDER BY id'
    );
    if (rows.length) {
      const cols = ['id','customer_id','name','visible','budget','color','time_budget','order_date','start','end','timezone','budget_type','billable'];
      const ph = '(' + cols.map(() => '?').join(',') + ')';
      const values: any[] = [];
      for (const r of rows) {
        values.push(r.id, r.customer_id, r.name, r.visible, r.budget, r.color, r.time_budget, r.order_date, r.start, r.end, r.timezone, r.budget_type, r.billable);
      }
      const sql = `INSERT INTO \`${stg}\` (${cols.join(',')}) VALUES ${rows.map(() => ph).join(',')}`;
      await atlasPool.query(sql, values);
    }
    const old = `${live}_old`;
    await atlasPool.query(`RENAME TABLE \`${live}\` TO \`${old}\`, \`${stg}\` TO \`${live}\``);
    await atlasPool.query(`DROP TABLE IF EXISTS \`${old}\``);
    // record last run + audit
    try {
      await atlasPool.query(
        'INSERT INTO sync_state (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value=VALUES(state_value), updated_at=CURRENT_TIMESTAMP',
        ['sync.projects.last_run', new Date().toISOString()]
      );
    } catch {}
    await recordAudit(_req as any, 200, crypto.createHash('sha256').update('syncProjects').digest('hex'));
    res.json({ message: `Projects synced: ${rows.length}` });
  } catch (e: any) {
    console.error('[syncProjects] failed:', e?.message || e);
    res.status(500).json({ error: 'Sync projects failed' });
  }
}

// Clear replica tables with a whitelist
const REPLICA_TABLES: Record<string, string> = {
  projects: 'replica_kimai_projects',
  timesheets: 'replica_kimai_timesheets',
  users: 'replica_kimai_users',
  activities: 'replica_kimai_activities',
  tags: 'replica_kimai_tags',
  timesheet_tags: 'replica_kimai_timesheet_tags',
  customers: 'replica_kimai_customers',
};

export async function clearReplicaHandler(req, res) {
  try {
    const kind = String(req.params.table || '').toLowerCase();
    const table = REPLICA_TABLES[kind];
    if (!table) {
      res.status(400).json({ error: 'Bad Request', reason: 'unknown_table' });
      return;
    }
    await atlasPool.query(`TRUNCATE TABLE \`${table}\``);
    await recordAudit(req as any, 200, crypto.createHash('sha256').update(`clear:${table}`).digest('hex'));
    res.json({ ok: true, table });
  } catch (e: any) {
    console.error('[sync:clear] failed:', e?.message || e);
    res.status(500).json({ error: 'Failed to clear replica table' });
  }
}

export async function syncUsersHandler(req, res) {
  try {
    console.log('[sync:users] API full refresh (staging-and-swap)');
    const live = 'replica_kimai_users';
    const stg = 'replica_kimai_users_stg';
    await atlasPool.query(`CREATE TABLE IF NOT EXISTS \`${live}\` (
      \`id\` int NOT NULL,
      \`username\` varchar(191),
      \`email\` varchar(191),
      \`enabled\` tinyint(1),
      \`color\` varchar(7),
      \`account\` varchar(30),
      \`system_account\` tinyint(1),
      \`supervisor_id\` int,
      \`timezone\` varchar(64),
      \`synced_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(\`id\`)
    )`);
    await atlasPool.query(`DROP TABLE IF EXISTS \`${stg}\``);
    await atlasPool.query(`CREATE TABLE \`${stg}\` LIKE \`${live}\``);
    let rows: any[] = [];
    try {
      const r: any = await kimaiPool.query(
        'SELECT id, username, email, enabled, color, account, system_account, supervisor_id, timezone FROM kimai2_users ORDER BY id'
      );
      rows = r[0] as any[];
    } catch {
      // Fallback schema without timezone column
      const r2: any = await kimaiPool.query(
        'SELECT id, username, email, enabled, color, account, system_account, supervisor_id FROM kimai2_users ORDER BY id'
      );
      rows = (r2[0] as any[]).map((x: any) => ({ ...x, timezone: null }));
    }
    if (rows.length) {
      const cols = ['id','username','email','enabled','color','account','system_account','supervisor_id','timezone'];
      const ph = '(' + cols.map(() => '?').join(',') + ')';
      const values: any[] = [];
      for (const r of rows) values.push(r.id, r.username, r.email, r.enabled, r.color, r.account, r.system_account, r.supervisor_id, r.timezone);
      const sql = `INSERT INTO \`${stg}\` (${cols.join(',')}) VALUES ${rows.map(() => ph).join(',')}`;
      await atlasPool.query(sql, values);
    }
    const old = `${live}_old`;
    await atlasPool.query(`RENAME TABLE \`${live}\` TO \`${old}\`, \`${stg}\` TO \`${live}\``);
    await atlasPool.query(`DROP TABLE IF EXISTS \`${old}\``);
    try {
      await atlasPool.query(
        'INSERT INTO sync_state (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value=VALUES(state_value), updated_at=CURRENT_TIMESTAMP',
        ['sync.users.last_run', new Date().toISOString()]
      );
    } catch {}
    await recordAudit(req as any, 200, crypto.createHash('sha256').update('syncUsers').digest('hex'));
    res.json({ message: `Users synced: ${rows.length}` });
  } catch (e: any) {
    console.error('[syncUsers] failed:', e?.message || e);
    res.status(500).json({ error: 'Sync users failed' });
  }
}

export async function syncActivitiesHandler(req, res) {
  try {
    console.log('[sync:activities] API full refresh (staging-and-swap)');
    const live = 'replica_kimai_activities';
    const stg = 'replica_kimai_activities_stg';
    await atlasPool.query(`CREATE TABLE IF NOT EXISTS \`${live}\` (
      \`id\` int NOT NULL,
      \`project_id\` int,
      \`name\` varchar(150),
      \`visible\` tinyint(1),
      \`billable\` tinyint(1),
      \`time_budget\` int,
      \`budget\` varchar(64),
      \`synced_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(\`id\`)
    )`);
    await atlasPool.query(`DROP TABLE IF EXISTS \`${stg}\``);
    await atlasPool.query(`CREATE TABLE \`${stg}\` LIKE \`${live}\``);
    const [rows]: any = await kimaiPool.query(
      'SELECT id, project_id, name, visible, billable, time_budget, budget FROM kimai2_activities ORDER BY id'
    );
    if (rows.length) {
      const cols = ['id','project_id','name','visible','billable','time_budget','budget'];
      const ph = '(' + cols.map(() => '?').join(',') + ')';
      const values: any[] = [];
      for (const r of rows) values.push(r.id, r.project_id, r.name, r.visible, r.billable, r.time_budget, r.budget);
      const sql = `INSERT INTO \`${stg}\` (${cols.join(',')}) VALUES ${rows.map(() => ph).join(',')}`;
      await atlasPool.query(sql, values);
    }
    const old = `${live}_old`;
    await atlasPool.query(`RENAME TABLE \`${live}\` TO \`${old}\`, \`${stg}\` TO \`${live}\``);
    await atlasPool.query(`DROP TABLE IF EXISTS \`${old}\``);
    try {
      await atlasPool.query(
        'INSERT INTO sync_state (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value=VALUES(state_value), updated_at=CURRENT_TIMESTAMP',
        ['sync.activities.last_run', new Date().toISOString()]
      );
    } catch {}
    await recordAudit(req as any, 200, crypto.createHash('sha256').update('syncActivities').digest('hex'));
    res.json({ message: `Activities synced: ${rows.length}` });
  } catch (e: any) {
    console.error('[syncActivities] failed:', e?.message || e);
    res.status(500).json({ error: 'Sync activities failed' });
  }
}

export async function syncTagsHandler(req, res) {
  try {
    console.log('[sync:tags] API full refresh (staging-and-swap) for tags and timesheet_tags');
    // Tags
    const liveTags = 'replica_kimai_tags';
    const stgTags = 'replica_kimai_tags_stg';
    await atlasPool.query(`CREATE TABLE IF NOT EXISTS \`${liveTags}\` (
      \`id\` int NOT NULL,
      \`name\` varchar(191),
      \`color\` varchar(7),
      \`synced_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(\`id\`)
    )`);
    await atlasPool.query(`DROP TABLE IF EXISTS \`${stgTags}\``);
    await atlasPool.query(`CREATE TABLE \`${stgTags}\` LIKE \`${liveTags}\``);
    const [tags]: any = await kimaiPool.query('SELECT id, name, color FROM kimai2_tags');
    if (tags.length) {
      const cols = ['id','name','color'];
      const ph = '(' + cols.map(() => '?').join(',') + ')';
      const values: any[] = [];
      for (const r of tags) values.push(r.id, r.name, r.color);
      const sql = `INSERT INTO \`${stgTags}\` (${cols.join(',')}) VALUES ${tags.map(() => ph).join(',')}`;
      await atlasPool.query(sql, values);
    }
    let old = `${liveTags}_old`;
    await atlasPool.query(`RENAME TABLE \`${liveTags}\` TO \`${old}\`, \`${stgTags}\` TO \`${liveTags}\``);
    await atlasPool.query(`DROP TABLE IF EXISTS \`${old}\``);
    // Timesheet tags
    const liveTt = 'replica_kimai_timesheet_tags';
    const stgTt = 'replica_kimai_timesheet_tags_stg';
    await atlasPool.query(`CREATE TABLE IF NOT EXISTS \`${liveTt}\` (
      \`timesheet_id\` int NOT NULL,
      \`tag_id\` int NOT NULL,
      \`synced_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(\`timesheet_id\`,\`tag_id\`)
    )`);
    await atlasPool.query(`DROP TABLE IF EXISTS \`${stgTt}\``);
    await atlasPool.query(`CREATE TABLE \`${stgTt}\` LIKE \`${liveTt}\``);
    const [tsTags]: any = await kimaiPool.query('SELECT timesheet_id, tag_id FROM kimai2_timesheet_tags');
    if (tsTags.length) {
      const cols2 = ['timesheet_id','tag_id'];
      const ph2 = '(' + cols2.map(() => '?').join(',') + ')';
      const values2: any[] = [];
      for (const r of tsTags) values2.push(r.timesheet_id, r.tag_id);
      const sql2 = `INSERT INTO \`${stgTt}\` (${cols2.join(',')}) VALUES ${tsTags.map(() => ph2).join(',')}`;
      await atlasPool.query(sql2, values2);
    }
    old = `${liveTt}_old`;
    await atlasPool.query(`RENAME TABLE \`${liveTt}\` TO \`${old}\`, \`${stgTt}\` TO \`${liveTt}\``);
    await atlasPool.query(`DROP TABLE IF EXISTS \`${old}\``);
    try {
      await atlasPool.query(
        'INSERT INTO sync_state (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value=VALUES(state_value), updated_at=CURRENT_TIMESTAMP',
        ['sync.tags.last_run', new Date().toISOString()]
      );
    } catch {}
    await recordAudit(req as any, 200, crypto.createHash('sha256').update('syncTags').digest('hex'));
    res.json({ message: `Tags synced: ${tags.length}, timesheet tags: ${tsTags.length}` });
  } catch (e: any) {
    console.error('[syncTags] failed:', e?.message || e);
    res.status(500).json({ error: 'Sync tags failed' });
  }
}

export async function syncCustomersHandler(req, res) {
  try {
    console.log('[sync:customers] API full refresh (staging-and-swap)');
    const live = 'replica_kimai_customers';
    const stg = 'replica_kimai_customers_stg';
    await atlasPool.query(`CREATE TABLE IF NOT EXISTS \`${live}\` (
      \`id\` int NOT NULL,
      \`name\` varchar(191),
      \`visible\` tinyint(1),
      \`timezone\` varchar(64),
      \`currency\` varchar(8),
      \`synced_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(\`id\`)
    )`);
    await atlasPool.query(`DROP TABLE IF EXISTS \`${stg}\``);
    await atlasPool.query(`CREATE TABLE \`${stg}\` LIKE \`${live}\``);
    const [rows]: any = await kimaiPool.query('SELECT id, name, visible, timezone, currency FROM kimai2_customers ORDER BY id');
    if (rows.length) {
      const cols = ['id','name','visible','timezone','currency'];
      const ph = '(' + cols.map(() => '?').join(',') + ')';
      const values: any[] = [];
      for (const r of rows) values.push(r.id, r.name, r.visible, r.timezone, r.currency);
      const sql = `INSERT INTO \`${stg}\` (${cols.join(',')}) VALUES ${rows.map(() => ph).join(',')}`;
      await atlasPool.query(sql, values);
    }
    const old = `${live}_old`;
    await atlasPool.query(`RENAME TABLE \`${live}\` TO \`${old}\`, \`${stg}\` TO \`${live}\``);
    await atlasPool.query(`DROP TABLE IF EXISTS \`${old}\``);
    try {
      await atlasPool.query(
        'INSERT INTO sync_state (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value=VALUES(state_value), updated_at=CURRENT_TIMESTAMP',
        ['sync.customers.last_run', new Date().toISOString()]
      );
    } catch {}
    await recordAudit(req as any, 200, crypto.createHash('sha256').update('syncCustomers').digest('hex'));
    res.json({ message: `Customers synced: ${rows.length}` });
  } catch (e: any) {
    console.error('[syncCustomers] failed:', e?.message || e);
    res.status(500).json({ error: 'Sync customers failed' });
  }
}
