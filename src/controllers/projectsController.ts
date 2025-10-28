import { Request, Response } from 'express';
import { Kimai } from '../services/kimai';
import { ProjectOverrides } from '../services/projectOverrides';
import { DataEnricher } from '../services/DataEnricher';
import { atlasPool } from '../../db';
import { StatusService } from '../services/statusService';

export async function getProjectsHandler(req: Request, res: Response): Promise<void> {
    // Simulate latency for UI skeletons / loading states
    // await new Promise((resolve) => setTimeout(resolve, 2000));
    const projects = await Kimai.getProjects();
    const overrides = await ProjectOverrides.getAll();
    const enriched = DataEnricher.enrichProjects(projects, overrides);
    const enrichedKimai = enriched.map(r => ({ ...r, origin: 'kimai' as const }));

    // Inclusion controls
    const includeParam = String((req.query as any)?.include || '').trim().toLowerCase();
    let includeKimai = true;
    let includeAtlas = false;
    if (includeParam) {
      const parts = new Set(includeParam.split(',').map(s => s.trim()).filter(Boolean));
      includeKimai = parts.has('kimai');
      includeAtlas = parts.has('atlas') || parts.has('prospective');
    } else {
      // Legacy flag support: includeProspective=1|true to include atlas
      const rawFlag = (req.query as any)?.includeProspective;
      const flagStr = rawFlag == null ? '' : String(rawFlag).trim().toLowerCase();
      includeAtlas = flagStr !== '' && flagStr !== '0' && flagStr !== 'false' && flagStr !== 'no';
    }

    if (!includeAtlas) {
      res.json(includeKimai ? enrichedKimai : []);
      return;
    }

    try {
      // Ensure status lookup table exists so LEFT JOIN does not fail in fresh envs
      await StatusService.ensureSchema();
      let rows: any[] = []
      try {
        const [withJoin]: any = await atlasPool.query(
          `SELECT o.id AS override_id, o.status_id, o.is_prospective, o.money_collected, o.notes,
                  o.updated_by_user_id, o.extras_json, o.created_at, o.updated_at, s.name AS status_name
             FROM project_overrides o
             LEFT JOIN project_statuses s ON s.id = o.status_id
            WHERE o.kimai_project_id IS NULL
            ORDER BY o.updated_at DESC, o.id DESC`
        );
        rows = withJoin as any[]
      } catch (e) {
        // Fallback: query without join if lookup table causes issues
        const [noJoin]: any = await atlasPool.query(
          `SELECT o.id AS override_id, o.status_id, o.is_prospective, o.money_collected, o.notes,
                  o.updated_by_user_id, o.extras_json, o.created_at, o.updated_at
             FROM project_overrides o
            WHERE o.kimai_project_id IS NULL
            ORDER BY o.updated_at DESC, o.id DESC`
        );
        rows = noJoin as any[]
      }
      if (!rows || rows.length === 0) {
        // Last-resort: simplified query without any joins to ensure Atlas-native rows surface
        const [simple]: any = await atlasPool.query(
          `SELECT id AS override_id, status_id, is_prospective, money_collected, notes, created_by_user_id,
                  updated_by_user_id, extras_json, created_at, updated_at
             FROM project_overrides
            WHERE kimai_project_id IS NULL
            ORDER BY updated_at DESC, id DESC`
        );
        rows = simple as any[]
      }
      const atlasRows = rows.map(r => {
        let name: string | null = null;
        try { name = r.extras_json ? (JSON.parse(r.extras_json).name || null) : null; } catch {}
        const virtualId = -Number(r.override_id); // negative id space for Atlas-native
        return {
          id: virtualId,
          customer_id: null,
          name: name || 'Prospective Project',
          order_number: null,
          comment: r.notes || null,
          visible: 1,
          budget: 0,
          color: null,
          time_budget: 0,
          order_date: null,
          start: null,
          end: null,
          timezone: null,
          budget_type: null,
          billable: 0,
          invoice_text: null,
          global_activities: 0,
          statusId: r.status_id ?? null,
          moneyCollected: r.money_collected ?? 0,
          isProspective: !!r.is_prospective, // Atlas-native invariant is true now
          createdByUserId: null,
          updatedByUserId: r.updated_by_user_id ?? null,
          origin: 'atlas' as const,
          createdAt: r.created_at ?? null,
          updatedAt: r.updated_at ?? null,
        };
      });
      const kimaiPart = includeKimai ? enrichedKimai : [];
      res.json([...atlasRows, ...kimaiPart]);
      return;
    } catch (e) {
      // If prospective fetch fails, last-resort: return atlas rows via a simple query
      try {
        const [simple]: any = await atlasPool.query(
          `SELECT id AS override_id, status_id, is_prospective, money_collected, notes,
                  updated_by_user_id, extras_json, created_at, updated_at
             FROM project_overrides
            WHERE kimai_project_id IS NULL
            ORDER BY updated_at DESC, id DESC`
        );
        const atlasRows = (simple as any[]).map(r => {
          let name: string | null = null;
          try { name = r.extras_json ? (JSON.parse(r.extras_json).name || null) : null; } catch {}
          return {
            id: -Number(r.override_id),
            customer_id: null,
            name: name || 'Prospective Project',
            order_number: null,
            comment: r.notes || null,
            visible: 1,
            budget: 0,
            color: null,
            time_budget: 0,
            order_date: null,
            start: null,
            end: null,
            timezone: null,
            budget_type: null,
            billable: 0,
            invoice_text: null,
            global_activities: 0,
            statusId: r.status_id ?? null,
            moneyCollected: r.money_collected ?? 0,
            isProspective: !!r.is_prospective,
            createdByUserId: null,
            updatedByUserId: r.updated_by_user_id ?? null,
            origin: 'atlas' as const,
            createdAt: r.created_at ?? null,
            updatedAt: r.updated_at ?? null,
          };
        });
        const kimaiPart = includeKimai ? enrichedKimai : [];
        res.json([...atlasRows, ...kimaiPart]);
        return;
      } catch {
        // Final fallback: Kimai-only (or empty if excluded)
        res.json(includeKimai ? enrichedKimai : []);
        return;
      }
    }
}

export async function getDetailedTimesheetsHandler(_req, res) {
    const rows = await Kimai.getDetailedTimesheets();
    const overrides = await ProjectOverrides.getAll();
    const enriched = DataEnricher.enrichTimesheets(rows, overrides);
    res.json(enriched);
}

export async function updateProjectStatusHandler(req, res) {
  const { kimai_project_id, status_id } = req.body || {};
  const pid = Number(kimai_project_id);
  if (!Number.isFinite(pid) || status_id === undefined || status_id === null) {
    return res.status(400).json({ error: 'Missing or invalid kimai_project_id or status_id' });
  }
  const sid = Number(status_id);
  if (!Number.isFinite(sid)) {
    return res.status(400).json({ error: 'Invalid status_id' });
  }
  await ProjectOverrides.updateStatusId(pid, sid);
  res.json({ message: 'Project status updated.' });
}
