import { ProjectOverrides } from '../services/projectOverrides';
import crypto from 'crypto';
import { recordAudit } from '../services/audit';

export async function updateProjectStatusHandler(req, res) {
  const { kimai_project_id, status } = req.body;

  if (!kimai_project_id || !status) {
    const resp = { error: 'Missing kimai_project_id or status' };
    await recordAudit(req, 400, crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex'));
    return res.status(400).json(resp);
  }

  await ProjectOverrides.updateStatus(kimai_project_id, status);
  await recordAudit(
    req,
    200,
    crypto.createHash('sha256').update(JSON.stringify({ kimai_project_id, status })).digest('hex')
  );
  res.json({ message: 'Project status updated.' });
}
