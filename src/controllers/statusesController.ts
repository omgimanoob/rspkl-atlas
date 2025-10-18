import { StatusService } from '../services/statusService';
import { recordAudit } from '../services/audit';

export async function listStatusesHandler(_req, res) {
  const rows = await StatusService.list();
  return res.json(rows);
}

export async function createStatusHandler(req, res) {
  const { name, code, is_active, sort_order } = req.body || {};
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Bad Request', reason: 'invalid_name' });
  try {
    const row = await StatusService.create({ name, code, is_active, sort_order });
    await recordAudit(req, 201);
    return res.status(201).json(row);
  } catch (e: any) {
    return res.status(400).json({ error: 'Bad Request', reason: 'conflict_or_invalid' });
  }
}

export async function updateStatusHandler(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Bad Request', reason: 'invalid_id' });
  const { name, code, is_active, sort_order } = req.body || {};
  try {
    const row = await StatusService.update(id, { name, code, is_active, sort_order });
    if (!row) return res.status(404).json({ error: 'Not Found' });
    await recordAudit(req, 200);
    return res.json(row);
  } catch (e: any) {
    return res.status(400).json({ error: 'Bad Request', reason: 'conflict_or_invalid' });
  }
}

export async function deleteStatusHandler(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Bad Request', reason: 'invalid_id' });
  await StatusService.delete(id);
  await recordAudit(req, 200);
  return res.json({ ok: true });
}

