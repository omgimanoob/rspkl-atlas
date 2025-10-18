import { atlasPool } from '../../db';
import { recordAudit } from '../services/audit';
import { incProspectiveCreate, incProspectiveLink } from '../services/metrics';

function asBool(v: any): number | null {
  if (v === undefined || v === null) return null;
  return v ? 1 : 0;
}

export async function createProspectiveHandler(req, res) {
  try {
    const { name, status, notes } = req.body || {};
    const extras = name ? JSON.stringify({ name }) : null;
    const isProspective = 1;
    const sql = `INSERT INTO overrides_projects (kimai_project_id, status, is_prospective, notes, extras_json)
                 VALUES (NULL, ?, ?, ?, ?)`;
    const params = [
      status ?? null,
      isProspective,
      notes ?? null,
      extras,
    ];
    const [result]: any = await atlasPool.query(sql, params);
    const id = result.insertId;
    incProspectiveCreate();
    await recordAudit(req, 201);
    res.status(201).json({ id, kimai_project_id: null, status: status ?? null, is_prospective: true, notes: notes ?? null, name: name ?? null });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to create prospective project' });
  }
}

export async function listProspectiveHandler(_req, res) {
  try {
    const [rows]: any = await atlasPool.query('SELECT id, kimai_project_id, status, is_prospective, notes, extras_json FROM overrides_projects WHERE kimai_project_id IS NULL ORDER BY updated_at DESC, id DESC');
    const items = rows.map((r: any) => ({
      id: r.id,
      kimai_project_id: r.kimai_project_id,
      status: r.status,
      is_prospective: !!r.is_prospective,
      notes: r.notes,
      name: r.extras_json ? (JSON.parse(r.extras_json).name || null) : null,
    }));
    res.json(items);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to list prospective projects' });
  }
}

export async function linkProspectiveHandler(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Bad Request', reason: 'invalid_id' });
    const kimaiId = Number(req.body?.kimai_project_id);
    if (!Number.isFinite(kimaiId)) return res.status(400).json({ error: 'Bad Request', reason: 'invalid_kimai_project_id' });
    // Ensure row exists and is prospective
    const [rows]: any = await atlasPool.query('SELECT id, kimai_project_id FROM overrides_projects WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not Found' });
    if (rows[0].kimai_project_id) return res.status(400).json({ error: 'Bad Request', reason: 'already_linked' });
    // Ensure no other override already linked to this kimai project
    const [dups]: any = await atlasPool.query('SELECT id FROM overrides_projects WHERE kimai_project_id = ? LIMIT 1', [kimaiId]);
    if (dups.length) return res.status(409).json({ error: 'Conflict', reason: 'override_exists_for_project' });
    await atlasPool.query(
      'UPDATE overrides_projects SET kimai_project_id = ?, is_prospective = 0 WHERE id = ?',
      [kimaiId, id]
    );
    incProspectiveLink();
    await recordAudit(req, 200);
    res.json({ id, kimai_project_id: kimaiId, is_prospective: false });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to link prospective project' });
  }
}
