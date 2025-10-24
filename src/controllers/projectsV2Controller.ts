import { Request, Response } from 'express'
import { atlasPool, kimaiPool } from '../../db'
import { Kimai } from '../services/kimai'
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
  return { includeKimai: false, includeAtlas: false }
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

    let out: ProjectDTO[] = []

    if (includeAtlas) {
      const [rows]: any = await atlasPool.query(
        `SELECT id, name, status_id, notes, extras_json, created_at, updated_at
           FROM atlas_projects
          ORDER BY updated_at DESC, id DESC`
      )
      for (const r of rows as any[]) {
        // Prefer the dedicated name column, but fall back to extras_json for older rows
        let display = typeof r.name === 'string' && r.name.trim() ? r.name.trim() : ''
        if (!display && r.extras_json) {
          try {
            const raw = typeof r.extras_json === 'string'
              ? r.extras_json
              : Buffer.isBuffer(r.extras_json)
                ? r.extras_json.toString('utf8')
                : JSON.stringify(r.extras_json)
            const parsed = JSON.parse(raw)
            const extraName = parsed?.name
            if (typeof extraName === 'string' && extraName.trim()) display = extraName.trim()
          } catch {/* ignore malformed extras */}
        }
        if (!display) display = 'Prospective Project'
        if (q && !display.toLowerCase().includes(q)) continue
        out.push({
          origin: 'atlas',
          id: -Number(r.id),
          atlasId: Number(r.id),
          displayName: display,
          statusId: r.status_id ?? null,
          statusName: r.status_id ? (statusMap.get(Number(r.status_id)) || null) : null,
          isProspective: true,
          moneyCollected: null,
          createdAt: r.created_at ?? null,
          updatedAt: r.updated_at ?? null,
        })
      }
    }

    if (includeKimai) {
      const kimai = await Kimai.getProjects()
      const overrides = await ProjectOverridesV2.getAll()
      for (const p of kimai as any[]) {
        const ov = (overrides as any[]).find(o => o.kimai_project_id === p.id)
        const display = String(p.name || '')
        if (q && !display.toLowerCase().includes(q)) continue
        const statusId = ov?.status_id ?? null
        out.push({
          origin: 'kimai',
          id: Number(p.id),
          kimaiId: Number(p.id),
          displayName: display,
          statusId,
          statusName: statusId ? (statusMap.get(Number(statusId)) || null) : null,
          isProspective: false,
          moneyCollected: ov?.money_collected != null ? Number(ov.money_collected) : null,
          createdAt: ov?.created_at ?? null,
          updatedAt: ov?.updated_at ?? null,
        })
      }
    }

    // Compute facets (before filters other than origin+search): totals by origin and by status
    const counts = {
      kimai: out.filter(r => r.origin === 'kimai').length,
      atlas: out.filter(r => r.origin === 'atlas').length,
    }
    const statusFacetMap = new Map<number, { id: number; name: string | null; count: number }>()
    for (const r of out) {
      const sid = r.statusId
      if (sid == null) continue
      const key = Number(sid)
      const ex = statusFacetMap.get(key)
      if (ex) ex.count += 1
      else statusFacetMap.set(key, { id: key, name: r.statusName, count: 1 })
    }
    const statusFacets = Array.from(statusFacetMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    // Filters
    const wantsNullStatus = typeof statusNullParam === 'string'
      ? ['1', 'true', 'yes'].includes(statusNullParam.toLowerCase())
      : !!statusNullParam
    if (statusIdParam != null && statusIdParam !== '') {
      const rawParts = String(statusIdParam).split(',').map(s => s.trim()).filter(Boolean)
      const wanted = new Set(rawParts.map(s => Number(s)).filter(n => Number.isFinite(n)))
      const includeNull = wantsNullStatus || rawParts.some(p => ['null', 'none'].includes(p.toLowerCase()))
      out = out.filter(r => {
        if (r.statusId == null) return includeNull
        return wanted.size ? wanted.has(Number(r.statusId)) : false
      })
    } else if (wantsNullStatus) {
      out = out.filter(r => r.statusId == null)
    }
    if (isProspectiveParam != null && isProspectiveParam !== '') {
      const val = String(isProspectiveParam).toLowerCase();
      const want = !(val === '0' || val === 'false' || val === 'no')
      out = out.filter(r => r.isProspective === want)
    }

    // Sorting
    const [rawKey, rawDir] = sortParamRaw.split(':')
    const sortKeyInput = (rawKey || '').trim()
    const sortDir = ((rawDir || '').trim().toLowerCase() === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc'
    const resolveSortKey = (key: string): keyof ProjectDTO | '' => {
      const lower = key.toLowerCase()
      switch (lower) {
        case 'displayname':
        case 'name':
          return 'displayName'
        case 'updatedat':
          return 'updatedAt'
        case 'createdat':
          return 'createdAt'
        case 'statusid':
          return 'statusId'
        case 'moneycollected':
          return 'moneyCollected'
        case 'origin':
          return 'origin'
        default:
          return ''
      }
    }
    const sortKey = resolveSortKey(sortKeyInput)
    const cmp = (a: any, b: any) => (a < b ? -1 : a > b ? 1 : 0)
    if (sortKey) {
      out.sort((a, b) => {
        let va: any = (a as any)[sortKey]
        let vb: any = (b as any)[sortKey]
        if (sortKey === 'displayName' || sortKey === 'origin') {
          const base = String(va || '').localeCompare(String(vb || ''))
          return sortDir === 'desc' ? -base : base
        }
        if (sortKey === 'updatedAt' || sortKey === 'createdAt') {
          const da = va ? new Date(va).getTime() : 0
          const db = vb ? new Date(vb).getTime() : 0
          const base = cmp(da, db)
          return sortDir === 'desc' ? -base : base
        }
        if (sortKey === 'statusId' || sortKey === 'moneyCollected') {
          const base = cmp(Number(va ?? 0), Number(vb ?? 0))
          return sortDir === 'desc' ? -base : base
        }
        // normalize and use localeCompare for strings
        if (typeof va === 'string' && typeof vb === 'string') {
          const base = va.localeCompare(vb)
          return sortDir === 'desc' ? -base : base
        }
        const base = cmp(va ?? '', vb ?? '')
        return sortDir === 'desc' ? -base : base
      })
    } else {
      // default sort: updatedAt desc
      out.sort((a, b) => {
        const da = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const db = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return db - da
      })
    }

    const total = out.length
    const start = (page - 1) * pageSize
    const items = out.slice(start, start + pageSize)

    res.json({ items, total, page, pageSize, counts, statusFacets })
    return
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to list projects v2' })
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
      isProspective: true, moneyCollected: null, createdAt: null, updatedAt: null
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
    const [dups]: any = await atlasPool.query('SELECT id FROM overrides_projects WHERE kimai_project_id = ? LIMIT 1', [kimaiId])
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
    const { status_id, money_collected } = req.body || {}
    await ProjectsV2Schema.ensure()
    const payload: any = { kimai_project_id: kimaiId }
    if (status_id !== undefined) payload.status_id = status_id === null ? null : Number(status_id)
    if (money_collected !== undefined) payload.money_collected = money_collected === null ? null : Number(money_collected)
    await ProjectOverridesV2.upsert(payload)
    res.json({ ok: true })
    return
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to update overrides (v2)' })
    return
  }
}
