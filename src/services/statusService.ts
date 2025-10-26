import { atlasPool } from '../../db';

export type ProjectStatusRow = {
  id: number;
  name: string;
  code: string | null;
  color?: string | null;
  is_active: number;
  sort_order: number | null;
};

export const StatusService = {
  slugify(name: string): string {
    return String(name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  },

  async nextSortOrder(): Promise<number> {
    const [rows]: any = await atlasPool.query('SELECT COALESCE(MAX(sort_order), 0) AS max_so FROM project_statuses');
    const max = Number(rows?.[0]?.max_so || 0);
    return max + 10;
  },

  async ensureUniqueCode(base: string, excludeId?: number | null): Promise<string> {
    const b = base || 'status';
    const like = b.replace(/[%_]/g, '') + '%';
    const params: any[] = [b, like];
    let sql = 'SELECT code FROM project_statuses WHERE (code = ? OR code LIKE ?)';
    if (excludeId && Number.isFinite(excludeId)) { sql += ' AND id <> ?'; params.push(excludeId); }
    const [rows]: any = await atlasPool.query(sql, params);
    const existing = new Set<string>((rows || []).map((r: any) => String(r.code || '')));
    if (!existing.has(b)) return b;
    // Find next available suffix like base-2, base-3, ...
    let n = 2;
    while (existing.has(`${b}-${n}`)) n++;
    return `${b}-${n}`;
  },
  async ensureSchema() {
    // Create lookup table
    await atlasPool.query(`CREATE TABLE IF NOT EXISTS project_statuses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(64) NOT NULL,
      code VARCHAR(64) NULL,
      color VARCHAR(7) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY ux_project_statuses_name (name),
      UNIQUE KEY ux_project_statuses_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
    // Add color column if missing (for upgraded installs)
    try { await atlasPool.query('ALTER TABLE project_statuses ADD COLUMN color VARCHAR(7) NULL AFTER code'); } catch {}
    // Add status_id column to overrides_projects if missing
    try {
      await atlasPool.query('ALTER TABLE overrides_projects ADD COLUMN status_id INT NULL');
    } catch {}
    // Optional: index for status_id
    try { await atlasPool.query('CREATE INDEX ix_overrides_projects_status_id ON overrides_projects (status_id)'); } catch {}
  },

  async list(): Promise<ProjectStatusRow[]> {
    await this.ensureSchema();
    const [rows]: any = await atlasPool.query('SELECT id, name, code, color, is_active, sort_order FROM project_statuses ORDER BY sort_order IS NULL, sort_order ASC, name ASC');
    return rows as ProjectStatusRow[];
  },

  async create(input: { name: string; code?: string | null; color?: string | null; is_active?: boolean; sort_order?: number | null }) {
    await this.ensureSchema();
    const name = String(input.name).trim();
    let code = (input.code == null || String(input.code).trim() === '') ? this.slugify(name) : String(input.code).trim();
    code = await this.ensureUniqueCode(code);
    const color = input.color ? String(input.color).trim() : null;
    const isActive = input.is_active === false ? 0 : 1;
    const sortOrder = input.sort_order != null ? input.sort_order : await this.nextSortOrder();
    await atlasPool.query('INSERT INTO project_statuses (name, code, color, is_active, sort_order) VALUES (?,?,?,?,?)', [name, code, color, isActive, sortOrder]);
    const [rows]: any = await atlasPool.query('SELECT id, name, code, color, is_active, sort_order FROM project_statuses WHERE name = ? LIMIT 1', [name]);
    return rows[0] as ProjectStatusRow;
  },

  async update(id: number, input: { name?: string; code?: string | null; color?: string | null; is_active?: boolean; sort_order?: number | null }) {
    await this.ensureSchema();
    const fields: string[] = [];
    const vals: any[] = [];
    if (input.name !== undefined) { fields.push('name = ?'); vals.push(String(input.name).trim()); }
    if (input.code !== undefined) {
      let nextCode = (input.code == null || String(input.code).trim() === '')
        ? (input.name !== undefined ? this.slugify(String(input.name)) : null)
        : String(input.code).trim();
      if (nextCode !== null) {
        nextCode = await this.ensureUniqueCode(nextCode, id);
        fields.push('code = ?'); vals.push(nextCode);
      }
    }
    if (input.color !== undefined) { fields.push('color = ?'); vals.push(input.color ? String(input.color).trim() : null); }
    if (input.is_active !== undefined) { fields.push('is_active = ?'); vals.push(input.is_active ? 1 : 0); }
    if (input.sort_order !== undefined) {
      const so = input.sort_order != null ? input.sort_order : await this.nextSortOrder();
      fields.push('sort_order = ?'); vals.push(so);
    }
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
    const [rows]: any = await atlasPool.query('SELECT id, name, code, color, is_active, sort_order FROM project_statuses WHERE id = ? LIMIT 1', [id]);
    return (rows && rows[0]) || null;
  },
};
