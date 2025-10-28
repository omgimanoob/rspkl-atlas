import { Request, Response } from 'express'
import { atlasPool } from '../../db'

export async function listStudiosHandler(_req: Request, res: Response) {
  try {
    const [rows]: any = await atlasPool.query(
      `SELECT s.id, s.name, s.created_at, s.updated_at,
              COALESCE(COUNT(DISTINCT st.kimai_team_id), 0) AS team_count,
              COALESCE(COUNT(DISTINCT sd.replica_kimai_user_id), 0) AS director_count
         FROM studios s
         LEFT JOIN studio_teams st ON st.studio_id = s.id
         LEFT JOIN studio_directors sd ON sd.studio_id = s.id
        GROUP BY s.id, s.name, s.created_at, s.updated_at
        ORDER BY s.name ASC`
    )
    res.json({ items: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to list studios' })
  }
}

export async function createStudioHandler(req: Request, res: Response) {
  try {
    const name = String((req.body?.name ?? '')).trim()
    if (!name) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_name' }); return }
    const [ins]: any = await atlasPool.query('INSERT INTO studios (name) VALUES (?)', [name])
    res.status(201).json({ id: Number(ins.insertId), name })
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (msg.includes('ux_studios_name')) { res.status(409).json({ error: 'Conflict', reason: 'duplicate_name' }); return }
    res.status(500).json({ error: 'Failed to create studio' })
  }
}

export async function updateStudioHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params?.id)
    const name = String((req.body?.name ?? '')).trim()
    if (!Number.isFinite(id)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_id' }); return }
    if (!name) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_name' }); return }
    await atlasPool.query('UPDATE studios SET name = ? WHERE id = ?', [name, id])
    res.json({ id, name })
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (msg.includes('ux_studios_name')) { res.status(409).json({ error: 'Conflict', reason: 'duplicate_name' }); return }
    res.status(500).json({ error: 'Failed to update studio' })
  }
}

export async function deleteStudioHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params?.id)
    if (!Number.isFinite(id)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_id' }); return }
    // Best-effort cascade of mappings first
    try { await atlasPool.query('DELETE FROM studio_teams WHERE studio_id = ?', [id]) } catch {}
    try { await atlasPool.query('DELETE FROM studio_directors WHERE studio_id = ?', [id]) } catch {}
    await atlasPool.query('DELETE FROM studios WHERE id = ?', [id])
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to delete studio' })
  }
}

export async function listReplicaTeamsHandler(_req: Request, res: Response) {
  try {
    const [rows]: any = await atlasPool.query('SELECT id, name, color FROM replica_kimai_teams ORDER BY name ASC')
    res.json({ items: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to list teams' })
  }
}

export async function listStudioTeamsHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params?.id)
    if (!Number.isFinite(id)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_id' }); return }
    const [rows]: any = await atlasPool.query(
      `SELECT st.kimai_team_id AS team_id, t.name, t.color
         FROM studio_teams st
         LEFT JOIN replica_kimai_teams t ON t.id = st.kimai_team_id
        WHERE st.studio_id = ?
        ORDER BY t.name ASC`,
      [id]
    )
    res.json({ items: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to list studio teams' })
  }
}

export async function addStudioTeamHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params?.id)
    const teamId = Number((req.body?.kimai_team_id ?? req.body?.team_id))
    if (!Number.isFinite(id)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_id' }); return }
    if (!Number.isFinite(teamId)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_team_id' }); return }
    await atlasPool.query('INSERT IGNORE INTO studio_teams (studio_id, kimai_team_id) VALUES (?, ?)', [id, teamId])
    res.status(201).json({ ok: true, studio_id: id, kimai_team_id: teamId })
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to add team' })
  }
}

export async function removeStudioTeamHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params?.id)
    const teamId = Number(req.params?.teamId)
    if (!Number.isFinite(id)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_id' }); return }
    if (!Number.isFinite(teamId)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_team_id' }); return }
    await atlasPool.query('DELETE FROM studio_teams WHERE studio_id = ? AND kimai_team_id = ?', [id, teamId])
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to remove team' })
  }
}

// Replica users (Kimai users mirror)
export async function listReplicaUsersHandler(_req: Request, res: Response) {
  try {
    const [rows]: any = await atlasPool.query('SELECT id, username, alias, email, enabled FROM replica_kimai_users ORDER BY COALESCE(alias, username) ASC')
    res.json({ items: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to list users' })
  }
}

export async function listStudioDirectorsHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params?.id)
    if (!Number.isFinite(id)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_id' }); return }
    const [rows]: any = await atlasPool.query(
      `SELECT sd.replica_kimai_user_id AS user_id, COALESCE(u.alias, u.username) AS username, u.alias, u.username AS fallback_username, u.email
         FROM studio_directors sd
         LEFT JOIN replica_kimai_users u ON u.id = sd.replica_kimai_user_id
        WHERE sd.studio_id = ?
        ORDER BY COALESCE(u.alias, u.username) ASC`,
      [id]
    )
    res.json({ items: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to list directors' })
  }
}

export async function addStudioDirectorHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params?.id)
    const userId = Number((req.body?.replica_kimai_user_id ?? req.body?.user_id))
    if (!Number.isFinite(id)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_id' }); return }
    if (!Number.isFinite(userId)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_user_id' }); return }
    await atlasPool.query('INSERT IGNORE INTO studio_directors (studio_id, replica_kimai_user_id) VALUES (?, ?)', [id, userId])
    res.status(201).json({ ok: true, studio_id: id, replica_kimai_user_id: userId })
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to add director' })
  }
}

export async function removeStudioDirectorHandler(req: Request, res: Response) {
  try {
    const id = Number(req.params?.id)
    const userId = Number(req.params?.userId)
    if (!Number.isFinite(id)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_id' }); return }
    if (!Number.isFinite(userId)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_user_id' }); return }
    await atlasPool.query('DELETE FROM studio_directors WHERE studio_id = ? AND replica_kimai_user_id = ?', [id, userId])
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to remove director' })
  }
}
