import { TimesheetSync } from '../services/timesheetSync';
import crypto from 'crypto';
import { recordAudit } from '../services/audit';
import { kimaiPool, atlasPool } from '../../db';

export async function syncTimesheetsHandler(_req, res) {
  await TimesheetSync.syncTimesheets();
  await recordAudit(_req as any, 200, crypto.createHash('sha256').update('syncTimesheets').digest('hex'));
  res.json({ message: 'Timesheets synced.' });
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
    await recordAudit(_req as any, 200, crypto.createHash('sha256').update('syncProjects').digest('hex'));
    res.json({ message: `Projects synced: ${rows.length}` });
  } catch (e: any) {
    console.error('[syncProjects] failed:', e?.message || e);
    res.status(500).json({ error: 'Sync projects failed' });
  }
}
