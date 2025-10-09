import { atlasPool } from '../../db';

export class ProjectOverrides {
  static async getAll() {
    const [rows] = await atlasPool.query('SELECT * FROM overrides_projects');
    return rows;
  }

  static async updateStatus(kimai_project_id: number, status: string) {
    await atlasPool.query(
      `UPDATE overrides_projects SET status = ? WHERE kimai_project_id = ?`,
      [status, kimai_project_id]
    );
  }
}
