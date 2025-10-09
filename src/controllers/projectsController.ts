import { Request, Response } from 'express';
import { Kimai } from '../services/kimai';
import { ProjectOverrides } from '../services/projectOverrides';
import { DataEnricher } from '../services/DataEnricher';

export async function getProjectsHandler(_req: Request, res: Response) {
    const projects = await Kimai.getProjects();
    const overrides = await ProjectOverrides.getAll();
    const enriched = DataEnricher.enrichProjects(projects, overrides);
    res.json(enriched);
}

export async function getDetailedTimesheetsHandler(_req, res) {
    const rows = await Kimai.getDetailedTimesheets();
    const overrides = await ProjectOverrides.getAll();
    const enriched = DataEnricher.enrichTimesheets(rows, overrides);
    res.json(enriched);
}

export async function updateProjectStatusHandler(req, res) {
  const { kimai_project_id, status } = req.body;

  if (!kimai_project_id || !status) {
    return res.status(400).json({ error: 'Missing kimai_project_id or status' });
  }

  await ProjectOverrides.updateStatus(kimai_project_id, status);

  res.json({ message: 'Project status updated.' });
}