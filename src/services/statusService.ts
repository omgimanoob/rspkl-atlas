import { atlasPool } from '../../db';

export type ProjectStatusRow = {
  id: number;
  name: string;
  code: string | null;
  is_active: number;
  sort_order: number | null;
};

export const StatusService = {
  async ensureSchema() {
    // Create lookup table
    await atlasPool.query(`CREATE TABLE IF NOT EXISTS project_statuses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(64) NOT NULL,
      code VARCHAR(64) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY ux_project_statuses_name (name),
      UNIQUE KEY ux_project_statuses_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
    // Add status_id column to overrides_projects if missing
    try {
      await atlasPool.query('ALTER TABLE overrides_projects ADD COLUMN status_id INT NULL');
    } catch {}
    // Optional: index for status_id
    try { await atlasPool.query('CREATE INDEX ix_overrides_projects_status_id ON overrides_projects (status_id)'); } catch {}
  },

  async list(): Promise<ProjectStatusRow[]> {
    await this.ensureSchema();
    const [rows]: any = await atlasPool.query('SELECT id, name, code, is_active, sort_order FROM project_statuses ORDER BY sort_order IS NULL, sort_order ASC, name ASC');
    return rows as ProjectStatusRow[];
  },

  async create(input: { name: string; code?: string | null; is_active?: boolean; sort_order?: number | null }) {
    await this.ensureSchema();
    const name = String(input.name).trim();
    const code = input.code ? String(input.code).trim() : null;
    const isActive = input.is_active === false ? 0 : 1;
    const sortOrder = input.sort_order ?? null;
    await atlasPool.query('INSERT INTO project_statuses (name, code, is_active, sort_order) VALUES (?,?,?,?)', [name, code, isActive, sortOrder]);
    const [rows]: any = await atlasPool.query('SELECT id, name, code, is_active, sort_order FROM project_statuses WHERE name = ? LIMIT 1', [name]);
    return rows[0] as ProjectStatusRow;
  },

  async update(id: number, input: { name?: string; code?: string | null; is_active?: boolean; sort_order?: number | null }) {
    await this.ensureSchema();
    const fields: string[] = [];
    const vals: any[] = [];
    if (input.name !== undefined) { fields.push('name = ?'); vals.push(String(input.name).trim()); }
    if (input.code !== undefined) { fields.push('code = ?'); vals.push(input.code ? String(input.code).trim() : null); }
    if (input.is_active !== undefined) { fields.push('is_active = ?'); vals.push(input.is_active ? 1 : 0); }
    if (input.sort_order !== undefined) { fields.push('sort_order = ?'); vals.push(input.sort_order ?? null); }
    if (!fields.length) return this.getById(id);
    await atlasPool.query(`UPDATE project_statuses SET ${fields.join(', ')} WHERE id = ?`, [...vals, id]);
    return this.getById(id);
  },

  async delete(id: number) {
    await this.ensureSchema();
    await atlasPool.query('DELETE FROM project_statuses WHERE id = ?', [id]);
    return true;
  },

  async getById(id: number): Promise<ProjectStatusRow | null> {
    const [rows]: any = await atlasPool.query('SELECT id, name, code, is_active, sort_order FROM project_statuses WHERE id = ? LIMIT 1', [id]);
    return (rows && rows[0]) || null;
  },
};

