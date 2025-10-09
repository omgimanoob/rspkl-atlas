import { ProjectOverrides } from '../services/projectOverrides';

export async function updateProjectStatusHandler(req, res) {
  const { kimai_project_id, status } = req.body;

  if (!kimai_project_id || !status) {
    return res.status(400).json({ error: 'Missing kimai_project_id or status' });
  }

  await ProjectOverrides.updateStatus(kimai_project_id, status);

  res.json({ message: 'Project status updated.' });
}
