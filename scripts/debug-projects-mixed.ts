import 'dotenv/config'
import { atlasPool } from '../db'
import { StatusService } from '../src/services/statusService'

async function main() {
  const PORT = process.env.PORT
  const atlas = {
    host: process.env.ATLAS_DB_HOST,
    db: process.env.ATLAS_DB_DATABASE,
    user: process.env.ATLAS_DB_USER,
    port: process.env.ATLAS_DB_PORT,
  }

  console.log('=== Debug: Mixed /projects Prospective Segment ===')
  console.log('Env PORT:', PORT)
  console.log('Atlas DB:', atlas)

  // 1) Basic counts
  try {
    const [rows]: any = await atlasPool.query('SELECT COUNT(*) AS total, SUM(kimai_project_id IS NULL) AS atlas_null FROM overrides_projects')
    console.log('overrides_projects counts:', rows?.[0])
  } catch (e: any) {
    console.error('ERROR: counting overrides_projects failed:', e?.message || e)
  }

  // 2) Sample Prospective rows
  try {
    const [rows]: any = await atlasPool.query(
      'SELECT id, kimai_project_id, is_prospective, status_id, JSON_EXTRACT(extras_json, "$.name") AS name, created_at, updated_at FROM overrides_projects WHERE kimai_project_id IS NULL ORDER BY id DESC LIMIT 5'
    )
    console.log('Sample Prospective (kimai_project_id IS NULL):')
    console.table(rows)
  } catch (e: any) {
    console.error('ERROR: selecting Prospective rows failed:', e?.message || e)
  }

  // 3) Status table existence
  try {
    await StatusService.ensureSchema()
    const [rows]: any = await atlasPool.query('SELECT COUNT(*) AS statuses FROM project_statuses')
    console.log('project_statuses exists; count:', rows?.[0]?.statuses)
  } catch (e: any) {
    console.error('ERROR: status schema check failed:', e?.message || e)
  }

  // 4) Join query (as used by mixed route)
  try {
    const [rows]: any = await atlasPool.query(
      `SELECT o.id AS override_id, o.status_id, o.is_prospective, o.money_collected, o.notes,
              o.updated_by_user_id, o.extras_json, o.created_at, o.updated_at, s.name AS status_name
         FROM overrides_projects o
         LEFT JOIN project_statuses s ON s.id = o.status_id
        WHERE o.kimai_project_id IS NULL
        ORDER BY o.updated_at DESC, o.id DESC`
    )
    console.log('JOIN query rows:', rows.length)
    console.table(rows.slice(0, 3))
  } catch (e: any) {
    console.error('ERROR: JOIN query failed:', e?.message || e)
  }

  // 5) No-join query
  try {
    const [rows]: any = await atlasPool.query(
      `SELECT o.id AS override_id, o.status_id, o.is_prospective, o.money_collected, o.notes,
              o.updated_by_user_id, o.extras_json, o.created_at, o.updated_at
         FROM overrides_projects o
        WHERE o.kimai_project_id IS NULL
        ORDER BY o.updated_at DESC, o.id DESC`
    )
    console.log('NO-JOIN query rows:', rows.length)
    console.table(rows.slice(0, 3))
  } catch (e: any) {
    console.error('ERROR: NO-JOIN query failed:', e?.message || e)
  }

  // 6) Simple mapping preview
  try {
    const [rows]: any = await atlasPool.query(
      `SELECT id AS override_id, status_id, is_prospective, money_collected, notes,
              updated_by_user_id, extras_json, created_at, updated_at
         FROM overrides_projects
        WHERE kimai_project_id IS NULL
        ORDER BY updated_at DESC, id DESC LIMIT 3`
    )
    const mapped = (rows as any[]).map(r => {
      let name: string | null = null
      try { name = r.extras_json ? (JSON.parse(r.extras_json).name || null) : null } catch {}
      return {
        id: -Number(r.override_id),
        name: name || 'Prospective Project',
        origin: 'atlas',
        isProspective: !!r.is_prospective,
        statusId: r.status_id ?? null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }
    })
    console.log('Mapped sample (as mixed /projects would return):')
    console.table(mapped)
  } catch (e: any) {
    console.error('ERROR: mapping preview failed:', e?.message || e)
  }

  console.log('=== Done ===')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
