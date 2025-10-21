import { ProjectOverrides } from '../services/projectOverrides';
import crypto from 'crypto';
import { recordAudit } from '../services/audit';
import { StatusService } from '../services/statusService';
import { incOverrideStatusUpdate, incOverrideUpsert } from '../services/metrics';
import { validateProspectiveConsistency } from '../services/validators/projectConsistency';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function updateProjectStatusHandler(req, res) {
  const statusIdRaw = req.body?.status_id;
  const projectId = req.body?.id ?? req.body?.kimai_project_id;

  if (!projectId || statusIdRaw === undefined) {
    const resp = { error: 'Bad Request', reason: 'status_id_required_or_missing_project_id' };
    await recordAudit(req, 400, crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex'));
    return res.status(400).json(resp);
  }

  if (statusIdRaw !== undefined && statusIdRaw !== null) {
    const sid = Number(statusIdRaw);
    if (!Number.isFinite(sid)) {
      const resp = { error: 'Bad Request', reason: 'invalid_status_id' };
      await recordAudit(req, 400, crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex'));
      return res.status(400).json(resp);
    }
    const row = await StatusService.getById(sid);
    if (!row || row.is_active !== 1) {
      const resp = { error: 'Bad Request', reason: 'invalid_status_id' };
      await recordAudit(req, 400, crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex'));
      return res.status(400).json(resp);
    }
    await ProjectOverrides.updateStatusId(projectId, sid);
  }
  incOverrideStatusUpdate();
  await recordAudit(
    req,
    200,
    crypto.createHash('sha256').update(JSON.stringify({ id: projectId, status_id: statusIdRaw })).digest('hex')
  );
  res.json({ message: 'Project status updated.' });
}

export async function updateProjectOverridesHandler(req, res) {
  const { money_collected, is_prospective, status_id } = req.body || {};
  const projectId = req.body?.id ?? req.body?.kimai_project_id;
  if (!projectId) {
    const resp = { error: 'Missing id (project id)' };
    await recordAudit(req, 400, crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex'));
    return res.status(400).json(resp);
  }

  if (status_id !== undefined && status_id !== null) {
    const sid = Number(status_id);
    if (!Number.isFinite(sid)) {
      const resp = { error: 'Bad Request', reason: 'invalid_status_id' };
      await recordAudit(req, 400, crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex'));
      return res.status(400).json(resp);
    }
    const row = await StatusService.getById(sid);
    if (!row || row.is_active !== 1) {
      const resp = { error: 'Bad Request', reason: 'invalid_status_id' };
      await recordAudit(req, 400, crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex'));
      return res.status(400).json(resp);
    }
  }

  // Consistency rule: when is_prospective is non-zero, a Kimai project id must be provided (numeric)
  const consistency = validateProspectiveConsistency(projectId, is_prospective)
  if (!consistency.ok) {
    const resp = { error: 'Bad Request', reason: consistency.reason };
    await recordAudit(req, 400, crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex'));
    return res.status(400).json(resp);
  }

  // Artificial delay to simulate long-running processing (skip in tests)
  if (process.env.NODE_ENV === 'development') {
    await sleep(5000);
  }

  let normalizedStatusId = status_id as number | undefined;
  if (status_id !== undefined && status_id !== null) {
    const row = await StatusService.getById(Number(status_id));
    normalizedStatusId = row?.id;
  }
  const saved = await ProjectOverrides.upsertOverrides({ kimai_project_id: Number(projectId), status_id: normalizedStatusId ?? null, money_collected, is_prospective });
  incOverrideUpsert();
  await recordAudit(
    req,
    200,
    crypto.createHash('sha256').update(JSON.stringify({ id: projectId, status_id, money_collected, is_prospective })).digest('hex')
  );
  res.json(saved || {});
}
