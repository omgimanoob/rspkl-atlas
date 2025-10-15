import { ProjectOverrides } from '../services/projectOverrides';
import crypto from 'crypto';
import { recordAudit } from '../services/audit';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function updateProjectStatusHandler(req, res) {
  const status = req.body?.status;
  const projectId = req.body?.id ?? req.body?.kimai_project_id;

  if (!projectId || !status) {
    const resp = { error: 'Missing id (project id) or status' };
    await recordAudit(req, 400, crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex'));
    return res.status(400).json(resp);
  }

  await ProjectOverrides.updateStatus(projectId, status);
  await recordAudit(
    req,
    200,
    crypto.createHash('sha256').update(JSON.stringify({ id: projectId, status })).digest('hex')
  );
  res.json({ message: 'Project status updated.' });
}

export async function updateProjectOverridesHandler(req, res) {
  const { status, money_collected, is_prospective } = req.body || {};
  const projectId = req.body?.id ?? req.body?.kimai_project_id;
  if (!projectId) {
    const resp = { error: 'Missing id (project id)' };
    await recordAudit(req, 400, crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex'));
    return res.status(400).json(resp);
  }

  // Artificial delay to simulate long-running processing
  await sleep(5000);

  const saved = await ProjectOverrides.upsertOverrides({ kimai_project_id: projectId, status, money_collected, is_prospective });
  await recordAudit(
    req,
    200,
    crypto.createHash('sha256').update(JSON.stringify({ id: projectId, status, money_collected, is_prospective })).digest('hex')
  );
  res.json(saved || {});
}
