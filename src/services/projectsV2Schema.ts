import { atlasPool } from '../../db'

export const ProjectsV2Schema = {
  async ensure() {
    // atlas_projects
    await atlasPool.query(`CREATE TABLE IF NOT EXISTS atlas_projects (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      status_id INT NULL,
      notes VARCHAR(1024) NULL,
      kimai_project_id BIGINT UNSIGNED NULL,
      linked_at TIMESTAMP NULL,
      created_by_user_id BIGINT UNSIGNED NULL,
      updated_by_user_id BIGINT UNSIGNED NULL,
      created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      extras_json JSON NULL,
      UNIQUE KEY ux_atlas_projects_kimai (kimai_project_id),
      INDEX ix_atlas_projects_status_id (status_id),
      INDEX ix_atlas_projects_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)

    // project_overrides
    await atlasPool.query(`CREATE TABLE IF NOT EXISTS project_overrides (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      kimai_project_id BIGINT UNSIGNED NOT NULL,
      status_id INT NULL,
      money_collected DECIMAL(12,2) NULL,
      notes VARCHAR(1024) NULL,
      updated_by_user_id BIGINT UNSIGNED NULL,
      updated_by_email VARCHAR(255) NULL,
      created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      extras_json JSON NULL,
      UNIQUE KEY ux_project_overrides_kimai (kimai_project_id),
      INDEX ix_project_overrides_status_id (status_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)

    try {
      await atlasPool.query(`ALTER TABLE atlas_projects
        MODIFY COLUMN created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        MODIFY COLUMN updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`)
    } catch {}
    try {
      await atlasPool.query(`ALTER TABLE project_overrides
        MODIFY COLUMN created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        MODIFY COLUMN updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`)
    } catch {}

    // Optional migration from overrides_projects if target tables are empty
    const [cntAtlas]: any = await atlasPool.query('SELECT COUNT(*) AS c FROM atlas_projects')
    const [cntOverrides]: any = await atlasPool.query('SELECT COUNT(*) AS c FROM project_overrides')
    const needMig = Number(cntAtlas?.[0]?.c || 0) === 0 && Number(cntOverrides?.[0]?.c || 0) === 0
    if (needMig) {
      try {
        // atlas-native from overrides_projects
        await atlasPool.query(
          `INSERT INTO atlas_projects (name, status_id, notes, created_at, updated_at, extras_json)
           SELECT COALESCE(JSON_UNQUOTE(JSON_EXTRACT(extras_json, '$.name')), 'Prospective Project') AS name,
                  status_id, notes, created_at, updated_at, extras_json
             FROM overrides_projects WHERE kimai_project_id IS NULL`
        )
      } catch {}
      try {
        // project overrides from overrides_projects
        await atlasPool.query(
          `INSERT INTO project_overrides (kimai_project_id, status_id, money_collected, notes, created_at, updated_at, extras_json)
           SELECT kimai_project_id, status_id, money_collected, notes, created_at, updated_at, extras_json
             FROM overrides_projects WHERE kimai_project_id IS NOT NULL`
        )
      } catch {}
    }
  }
}
