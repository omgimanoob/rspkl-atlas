import { atlasPool } from '../../db'
import { StatusService } from './statusService'

export class ProjectOverridesV2 {
  static async getAll() {
    const [rows] = await atlasPool.query('SELECT * FROM project_overrides')
    return rows as any[]
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

  static async upsert(payload: {
    kimai_project_id: number,
    status_id?: number | null,
    money_collected?: number | null,
    updated_by_user_id?: number | null,
  }) {
    const id = payload.kimai_project_id
    const existing = await this.getByProjectId(id)

    const fields: string[] = []
    const values: any[] = []

    if (payload.money_collected !== undefined) {
      fields.push('money_collected = ?')
      values.push(payload.money_collected)
    }
    if (payload.status_id !== undefined) {
      await StatusService.ensureSchema()
      fields.push('status_id = ?')
      values.push(payload.status_id)
    }
    if (payload.updated_by_user_id !== undefined) {
      fields.push('updated_by_user_id = ?')
      values.push(payload.updated_by_user_id)
    }

    if (existing) {
      if (fields.length > 0) {
        const sql = `UPDATE project_overrides SET ${fields.join(', ')} WHERE kimai_project_id = ?`;
        await atlasPool.query(sql, [...values, id]);
      }
    } else {
      const cols = ['kimai_project_id']
      const qs = ['?']
      const insertVals: any[] = [id]
      if (payload.money_collected !== undefined) { cols.push('money_collected'); qs.push('?'); insertVals.push(payload.money_collected) }
      if (payload.status_id !== undefined) { await StatusService.ensureSchema(); cols.push('status_id'); qs.push('?'); insertVals.push(payload.status_id) }
      if (payload.updated_by_user_id !== undefined) { cols.push('updated_by_user_id'); qs.push('?'); insertVals.push(payload.updated_by_user_id) }
      const sql = `INSERT INTO project_overrides (${cols.join(',')}) VALUES (${qs.join(',')})`;
      await atlasPool.query(sql, insertVals)
    }

    return await this.getByProjectId(id)
  }
}

