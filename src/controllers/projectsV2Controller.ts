import { Request, Response } from 'express'
import { atlasPool, kimaiPool } from '../../db'
// import { Kimai } from '../services/kimai'
import { ProjectOverridesV2 } from '../services/projectOverridesV2'
import { ProjectsV2Schema } from '../services/projectsV2Schema'
import { StatusService } from '../services/statusService'

type ProjectDTO = {
  origin: 'kimai' | 'atlas'
  id: number
  kimaiId?: number
  atlasId?: number
  displayName: string
  statusId: number | null
  statusName: string | null
  isProspective: boolean
  moneyCollected: number | null
  notes: string | null
  comment: string | null
  createdAt: string | null
  updatedAt: string | null
}

function normalizeInclude(qs: any): { includeKimai: boolean; includeAtlas: boolean } {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(qs || {}, key)
  if (has('include')) {
    const p = String(qs?.include || '').trim().toLowerCase()
    if (!p) return { includeKimai: false, includeAtlas: false }
    const set = new Set(p.split(',').map(s => s.trim()).filter(Boolean))
    return { includeKimai: set.has('kimai'), includeAtlas: set.has('atlas') || set.has('prospective') }
  }
  if (has('includeProspective')) {
    const lf = String(qs?.includeProspective || '').trim().toLowerCase()
    const includeAtlas = lf !== '' && lf !== '0' && lf !== 'false' && lf !== 'no'
    return { includeKimai: true, includeAtlas }
  }
  // Default to both sources when unspecified
  return { includeKimai: true, includeAtlas: true }
}

export async function listProjectsV2Handler(req: Request, res: Response): Promise<void> {
  try {
    await ProjectsV2Schema.ensure()
    const { includeKimai, includeAtlas } = normalizeInclude(req.query)
    const q = String((req.query as any)?.q || '').trim().toLowerCase()
    const page = Math.max(1, Number((req.query as any)?.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number((req.query as any)?.pageSize) || 20))
    const statusIdParam = (req.query as any)?.statusId
    const statusNullParam = (req.query as any)?.statusNull
    const isProspectiveParam = (req.query as any)?.isProspective
    const sortParamRaw = String((req.query as any)?.sort || '').trim() // e.g., updatedAt:desc
    await StatusService.ensureSchema()
    // Status map
    const statusRows = await StatusService.list()
    const statusMap = new Map<number, string>()
    for (const s of statusRows) statusMap.set(s.id, s.name)

    // counts per origin with q
    let kimaiCount = 0, atlasCount = 0
    if (includeKimai) {
      const [rows]: any = await atlasPool.query(
        `SELECT COUNT(*) AS cnt
           FROM replica_kimai_projects p
           LEFT JOIN project_overrides o ON o.kimai_project_id = p.id
          WHERE (? = ''
                 OR LOWER(p.name) LIKE CONCAT('%', ?, '%')
                 OR LOWER(IFNULL(p.comment, '')) LIKE CONCAT('%', ?, '%')
                 OR LOWER(IFNULL(o.notes, '')) LIKE CONCAT('%', ?, '%')
          )`,
        [q, q, q, q]
      )
      kimaiCount = Number(rows?.[0]?.cnt || 0)
    }
    if (includeAtlas) {
      const [rows]: any = await atlasPool.query(
        `SELECT COUNT(*) AS cnt
           FROM atlas_projects a
          WHERE (? = ''
                 OR LOWER(a.name) LIKE CONCAT('%', ?, '%')
                 OR LOWER(IFNULL(a.notes, '')) LIKE CONCAT('%', ?, '%')
          )`,
        [q, q, q]
      )
      atlasCount = Number(rows?.[0]?.cnt || 0)
    }
    const counts = { kimai: kimaiCount, atlas: atlasCount }

    // status facets (with q + include)
    const [facetRows]: any = await atlasPool.query(
      `SELECT status_id, COUNT(*) AS cnt FROM (
         ${includeKimai ? `SELECT o.status_id AS status_id
                           FROM replica_kimai_projects p
                           LEFT JOIN project_overrides o ON o.kimai_project_id = p.id
                          WHERE (? = ''
                                 OR LOWER(p.name) LIKE CONCAT('%', ?, '%')
                                 OR LOWER(IFNULL(p.comment, '')) LIKE CONCAT('%', ?, '%')
                                 OR LOWER(IFNULL(o.notes, '')) LIKE CONCAT('%', ?, '%')
                          )` : 'SELECT NULL AS status_id WHERE 1=0'}
         UNION ALL
         ${includeAtlas ? `SELECT a.status_id AS status_id
                            FROM atlas_projects a
                           WHERE (? = '' OR LOWER(a.name) LIKE CONCAT('%', ?, '%') OR LOWER(IFNULL(a.notes, '')) LIKE CONCAT('%', ?, '%'))` : 'SELECT NULL AS status_id WHERE 1=0'}
       ) u GROUP BY status_id`,
      includeKimai && includeAtlas ? [q, q, q, q, q, q, q] : includeKimai ? [q, q, q, q] : includeAtlas ? [q, q, q] : []
    )
    const statusFacets = (facetRows as any[]).map(r => ({ id: r.status_id == null ? -1 : Number(r.status_id), name: r.status_id == null ? null : (statusMap.get(Number(r.status_id)) || null), count: Number(r.cnt) }))

    // Build union query with filters
    const wantKimai = includeKimai
    const wantAtlas = includeAtlas
    const statusIds = typeof statusIdParam === 'string' && statusIdParam.trim()
      ? statusIdParam.split(',').map((x: string) => Number(x)).filter((n: number) => Number.isFinite(n))
      : []
    const wantsNullStatus = String(statusNullParam || '').trim() !== '' && String(statusNullParam).toLowerCase() !== '0' && String(statusNullParam).toLowerCase() !== 'false'
    const isProspectiveFilter = typeof isProspectiveParam === 'string' ? (isProspectiveParam === '1' || isProspectiveParam.toLowerCase() === 'true') : (typeof isProspectiveParam === 'boolean' ? isProspectiveParam : undefined)

    const parts: string[] = []
    const params: any[] = []
    if (wantKimai) {
      parts.push(
        `SELECT 'kimai' AS origin,
                p.id AS id,
                p.id AS kimaiId,
                NULL AS atlasId,
                p.name AS displayName,
                o.status_id AS statusId,
                s.name AS statusName,
                o.money_collected AS moneyCollected,
                0 AS isProspective,
                o.notes AS notes,
                p.comment AS comment,
                o.created_at AS createdAt,
                o.updated_at AS updatedAt
           FROM replica_kimai_projects p
           LEFT JOIN project_overrides o ON o.kimai_project_id = p.id
           LEFT JOIN project_statuses s ON s.id = o.status_id
          WHERE (? = ''
                 OR LOWER(p.name) LIKE CONCAT('%', ?, '%')
                 OR LOWER(IFNULL(p.comment, '')) LIKE CONCAT('%', ?, '%')
                 OR LOWER(IFNULL(o.notes, '')) LIKE CONCAT('%', ?, '%')
          )`
      )
      params.push(q, q, q, q)
    }
    if (wantAtlas) {
      parts.push(
        `SELECT 'atlas' AS origin,
                (-a.id) AS id,
                NULL AS kimaiId,
                a.id AS atlasId,
                a.name AS displayName,
                a.status_id AS statusId,
                s.name AS statusName,
                NULL AS moneyCollected,
                1 AS isProspective,
                a.notes AS notes,
                NULL AS comment,
                a.created_at AS createdAt,
                a.updated_at AS updatedAt
           FROM atlas_projects a
           LEFT JOIN project_statuses s ON s.id = a.status_id
          WHERE (? = '' OR LOWER(a.name) LIKE CONCAT('%', ?, '%') OR LOWER(IFNULL(a.notes, '')) LIKE CONCAT('%', ?, '%'))`
      )
      params.push(q, q, q)
    }
    const base = parts.join(' UNION ALL ')
    if (!base) {
      // No sources selected; return empty result gracefully
      res.json({ items: [], total: 0, page, pageSize, counts: { kimai: 0, atlas: 0 }, statusFacets: [] })
      return
    }
    const where: string[] = []
    if (wantsNullStatus) {
      where.push('statusId IS NULL')
    } else if (statusIds.length) {
      where.push(`statusId IN (${statusIds.map(() => '?').join(',')})`)
      params.push(...statusIds)
    }
    if (typeof isProspectiveFilter === 'boolean') {
      where.push('isProspective = ?')
      params.push(isProspectiveFilter ? 1 : 0)
    }
    const wrapped = `SELECT * FROM (${base}) x ${where.length ? ('WHERE ' + where.join(' AND ')) : ''}`

    // Sort
    let orderBy = 'updatedAt DESC, id DESC'
    if (sortParamRaw) {
      const [k, d] = sortParamRaw.split(':')
      const dir = (d || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC'
      if (k === 'displayName' || k === 'name') orderBy = `displayName ${dir}, id DESC`
      else if (k === 'updatedAt') orderBy = `updatedAt ${dir}, id DESC`
      else if (k === 'statusId') orderBy = `statusId ${dir}, id DESC`
      else if (k === 'statusName' || k === 'status') orderBy = `statusName ${dir}, id DESC`
      else if (k === 'isProspective') orderBy = `isProspective ${dir}, id DESC`
      else if (k === 'id') orderBy = `id ${dir}`
      else if (k === 'notes') orderBy = `notes ${dir}, id DESC`
      else if (k === 'moneyCollected') orderBy = `moneyCollected ${dir}, id DESC`
    }

    const [totRows]: any = await atlasPool.query(`SELECT COUNT(*) AS cnt FROM (${wrapped}) t`, params)
    const total = Number(totRows?.[0]?.cnt || 0)
    const offset = (page - 1) * pageSize
    const [rows]: any = await atlasPool.query(`${wrapped} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...params, pageSize, offset])

    const items: ProjectDTO[] = (rows as any[]).map(r => ({
      origin: r.origin,
      id: Number(r.id),
      kimaiId: r.kimaiId != null ? Number(r.kimaiId) : undefined,
      atlasId: r.atlasId != null ? Number(r.atlasId) : undefined,
      displayName: String(r.displayName || ''),
      statusId: r.statusId != null ? Number(r.statusId) : null,
      statusName: r.statusId != null ? (statusMap.get(Number(r.statusId)) || null) : null,
      isProspective: !!r.isProspective,
      moneyCollected: r.moneyCollected != null ? Number(r.moneyCollected) : null,
      notes: r.notes ?? null,
      comment: r.comment ?? null,
      createdAt: r.createdAt || null,
      updatedAt: r.updatedAt || null,
    }))

    res.json({ items, total, page, pageSize, counts, statusFacets })
    return
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to list projects (v2)' })
    return
  }
}

export async function createProspectiveV2Handler(req: Request, res: Response): Promise<void> {
  try {
    const { name, status_id, notes } = req.body || {}
    if (!name || typeof name !== 'string') { res.status(400).json({ error: 'Bad Request', reason: 'invalid_name' }); return }
    await ProjectsV2Schema.ensure(); await StatusService.ensureSchema()
    let statusId: number | null = null
    if (status_id != null) {
      const sid = Number(status_id)
      if (!Number.isFinite(sid)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_status_id' }); return }
      const s = await StatusService.getById(sid)
      if (!s || s.is_active !== 1) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_status_id' }); return }
      statusId = s.id
    }
    const extras = JSON.stringify({ name })
    const [result]: any = await atlasPool.query(
      `INSERT INTO atlas_projects (name, status_id, notes, extras_json)
       VALUES (?, ?, ?, ?)`,
      [ name, statusId, notes ?? null, extras ]
    )
    const id = Number(result.insertId)
    const statusName = statusId ? (await StatusService.getById(statusId))?.name ?? null : null
    res.status(201).json({
      origin: 'atlas', id: -id, atlasId: id, displayName: name, statusId, statusName,
      isProspective: true, moneyCollected: null, notes: notes ?? null, createdAt: null, updatedAt: null
    })
    return
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to create prospective (v2)' })
    return
  }
}

export async function updateProspectiveV2Handler(req: Request, res: Response): Promise<void> {
  try {
    const atlasId = Number(req.params.id)
    if (!Number.isFinite(atlasId)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_id' }); return }
    await ProjectsV2Schema.ensure(); await StatusService.ensureSchema()
    const { name, status_id, notes } = req.body || {}
    const fields: string[] = []
    const vals: any[] = []
    if (name !== undefined) { fields.push('name = ?'); vals.push(String(name)) }
    if (status_id !== undefined) {
      if (status_id === null) { fields.push('status_id = NULL') } else {
        const sid = Number(status_id)
        if (!Number.isFinite(sid)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_status_id' }); return }
        const s = await StatusService.getById(sid)
        if (!s || s.is_active !== 1) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_status_id' }); return }
        fields.push('status_id = ?'); vals.push(sid)
      }
    }
    if (notes !== undefined) { fields.push('notes = ?'); vals.push(notes ?? null) }
    if (!fields.length) { res.status(400).json({ error: 'Bad Request', reason: 'no_changes' }); return }
    await atlasPool.query(`UPDATE atlas_projects SET ${fields.join(', ')} WHERE id = ?`, [...vals, atlasId])
    res.json({ ok: true })
    return
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to update prospective (v2)' })
    return
  }
}

export async function linkProspectiveV2Handler(req: Request, res: Response): Promise<void> {
  try {
    const atlasId = Number(req.params.id)
    if (!Number.isFinite(atlasId)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_id' }); return }
    const kimaiId = Number(req.body?.kimai_project_id)
    if (!Number.isFinite(kimaiId)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_kimai_project_id' }); return }
    // verify kimai id exists
    const [exists]: any = await kimaiPool.query('SELECT id FROM kimai2_projects WHERE id = ? LIMIT 1', [kimaiId])
    if (!exists || !exists.length) { res.status(400).json({ error: 'Bad Request', reason: 'unknown_kimai_project' }); return }
    // verify atlas row exists and not linked
    const [rows]: any = await atlasPool.query('SELECT id, kimai_project_id FROM atlas_projects WHERE id = ? LIMIT 1', [atlasId])
    if (!rows || !rows.length) { res.status(404).json({ error: 'Not Found' }); return }
    if (rows[0].kimai_project_id) { res.status(409).json({ error: 'Conflict', reason: 'already_linked' }); return }
    // conflict check for target kimai id
    const [dups]: any = await atlasPool.query('SELECT id FROM project_overrides WHERE kimai_project_id = ? LIMIT 1', [kimaiId])
    if (dups && dups.length) { res.status(409).json({ error: 'Conflict', reason: 'override_exists_for_project' }); return }
    await atlasPool.query('UPDATE atlas_projects SET kimai_project_id = ?, linked_at = CURRENT_TIMESTAMP WHERE id = ?', [kimaiId, atlasId])
    res.json({ ok: true, atlasId, kimaiId })
    return
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to link prospective (v2)' })
    return
  }
}

export async function updateKimaiOverridesV2Handler(req: Request, res: Response): Promise<void> {
  try {
    const kimaiId = Number(req.params.kimaiId)
    if (!Number.isFinite(kimaiId)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_id' }); return }
    const { status_id, notes } = req.body || {}
    await ProjectsV2Schema.ensure()
    const payload: any = { kimai_project_id: kimaiId }
    if (status_id !== undefined) payload.status_id = status_id === null ? null : Number(status_id)
    if (notes !== undefined) payload.notes = notes === null ? null : String(notes)
    await ProjectOverridesV2.upsert(payload)
    res.json({ ok: true })
    return
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to update overrides (v2)' })
    return
  }
}
