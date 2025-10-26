import { atlasPool, kimaiPool } from '../../db'

export class ProjectsSync {
  static async assertReplicaSchema() {
    const [rows]: any = await atlasPool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replica_kimai_projects'`
    )
    if (!rows || !rows.length) {
      throw new Error("replica_kimai_projects table is missing. Run DB migrations.")
    }
    const cols = new Set(rows.map((r: any) => String(r.COLUMN_NAME)))
    const required = ['id','customer_id','name','comment','visible','budget','color','time_budget','order_date','start','end','timezone','budget_type','billable']
    for (const c of required) {
      if (!cols.has(c)) {
        throw new Error(`replica_kimai_projects is missing column '${c}'. Run migrations (npm run db:migrate).`)
      }
    }
  }

  static async run(): Promise<number> {
    await this.assertReplicaSchema()
    const live = 'replica_kimai_projects'
    const stg = 'replica_kimai_projects_stg'
    // staging clone
    await atlasPool.query(`DROP TABLE IF EXISTS \`${stg}\``)
    await atlasPool.query(`CREATE TABLE \`${stg}\` LIKE \`${live}\``)

    const BATCH = 2000
    let offset = 0
    let total = 0
    for (;;) {
      const [rows]: any = await kimaiPool.query(
        'SELECT id, customer_id, name, comment, visible, budget, color, time_budget, order_date, start, end, timezone, budget_type, billable FROM kimai2_projects ORDER BY id LIMIT ? OFFSET ?',
        [BATCH, offset]
      )
      if (!rows.length) break
      const cols = ['id','customer_id','name','comment','visible','budget','color','time_budget','order_date','start','end','timezone','budget_type','billable']
      const ph = '(' + cols.map(() => '?').join(',') + ')'
      const values: any[] = []
      for (const r of rows) {
        values.push(
          r.id,
          r.customer_id,
          r.name,
          r.comment ?? null,
          r.visible,
          r.budget,
          r.color,
          r.time_budget,
          r.order_date,
          r.start,
          r.end,
          r.timezone,
          r.budget_type,
          r.billable,
        )
      }
      const sql = `INSERT INTO \`${stg}\` (${cols.join(',')}) VALUES ${rows.map(() => ph).join(',')}`
      await atlasPool.query(sql, values)
      total += rows.length
      offset += rows.length
    }

    const old = `${live}_old`
    await atlasPool.query(`RENAME TABLE \`${live}\` TO \`${old}\`, \`${stg}\` TO \`${live}\``)
    await atlasPool.query(`DROP TABLE IF EXISTS \`${old}\``)

    // Best-effort: copy Kimai project comments into project_overrides.notes when missing
    try {
      // Create overrides table if needed
      const { ProjectsV2Schema } = await import('./projectsV2Schema')
      await ProjectsV2Schema.ensure()
      // Insert notes from replica comments; do not overwrite non-empty existing notes
      await atlasPool.query(
        `INSERT INTO project_overrides (kimai_project_id, notes)
           SELECT p.id, p.comment
             FROM \`${live}\` p
             LEFT JOIN project_overrides o ON o.kimai_project_id = p.id
            WHERE o.kimai_project_id IS NULL
              AND p.comment IS NOT NULL AND TRIM(p.comment) <> ''`
      )
    } catch (e) {
      // ignore; copying comments to overrides is non-critical
    }

    try {
      await atlasPool.query(
        'INSERT INTO sync_state (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value=VALUES(state_value), updated_at=CURRENT_TIMESTAMP',
        ['sync.projects.last_run', new Date().toISOString()]
      )
    } catch {}
    return total
  }
}
