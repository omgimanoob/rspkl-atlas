import { atlasPool } from '../../db';
import { StatusService } from './statusService';

export class ProjectOverrides {
  static async getAll() {
    const [rows] = await atlasPool.query('SELECT * FROM project_overrides');
    return rows;
  }

  static async updateStatusId(kimai_project_id: number, status_id?: number | null) {
    await StatusService.ensureSchema();
    await atlasPool.query(
      `UPDATE project_overrides SET status_id = ? WHERE kimai_project_id = ?`,
      [status_id ?? null, kimai_project_id]
    );
  }

  static async getByProjectId(kimai_project_id: number) {
    const [rows] = await atlasPool.query<any[]>(
      `SELECT * FROM project_overrides WHERE kimai_project_id = ?
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`,
      [kimai_project_id]
    );
    return (rows as any[])[0] || null;
  }

  static async upsertOverrides(payload: {
    kimai_project_id: number,
    status_id?: number | null,
    money_collected?: number | null,
    is_prospective?: boolean | number | null,
    created_by_user_id?: number | null,
  }) {
    const id = payload.kimai_project_id;
    const existing = await this.getByProjectId(id);

    const fields: string[] = [];
    const values: any[] = [];

    if (payload.money_collected !== undefined) {
      fields.push('money_collected = ?');
      values.push(payload.money_collected);
    }
    if (payload.status_id !== undefined) {
      await StatusService.ensureSchema();
      fields.push('status_id = ?');
      values.push(payload.status_id);
    }
    if (payload.is_prospective !== undefined) {
      const prospective = payload.is_prospective ? 1 : 0;
      fields.push('is_prospective = ?');
      values.push(prospective);
    }
    if (payload.created_by_user_id !== undefined) {
      fields.push('created_by_user_id = ?');
      values.push(payload.created_by_user_id);
    }

    if (existing) {
      if (fields.length > 0) {
        const sql = `UPDATE project_overrides SET ${fields.join(', ')} WHERE kimai_project_id = ?`;
        await atlasPool.query(sql, [...values, id]);
      }
    } else {
      // Build INSERT only for provided columns plus kimai_project_id
      const cols = ['kimai_project_id'];
      const qs = ['?'];
      const insertVals: any[] = [id];
      if (payload.money_collected !== undefined) { cols.push('money_collected'); qs.push('?'); insertVals.push(payload.money_collected); }
      if (payload.status_id !== undefined) { await StatusService.ensureSchema(); cols.push('status_id'); qs.push('?'); insertVals.push(payload.status_id); }
      if (payload.is_prospective !== undefined) { cols.push('is_prospective'); qs.push('?'); insertVals.push(payload.is_prospective ? 1 : 0); }
      if (payload.created_by_user_id !== undefined) { cols.push('created_by_user_id'); qs.push('?'); insertVals.push(payload.created_by_user_id); }
      const sql = `INSERT INTO project_overrides (${cols.join(',')}) VALUES (${qs.join(',')})`;
      await atlasPool.query(sql, insertVals);
    }

    return await this.getByProjectId(id);
  }
}
