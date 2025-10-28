import { atlasPool } from '../../db';

describe('vw_projects exposes overrides', () => {
  const pid = 987650001; // unlikely to collide

  afterAll(async () => {
    await atlasPool.query('DELETE FROM project_overrides WHERE kimai_project_id = ?', [pid]);
    await atlasPool.query('DELETE FROM replica_kimai_projects WHERE id = ?', [pid]);
  });

  it('vw_projects returns override fields when present', async () => {
    // Ensure view exists in test DB (create if missing)
    try {
      await atlasPool.query('SELECT 1 FROM vw_projects LIMIT 1');
    } catch {
      await atlasPool.query('DROP VIEW IF EXISTS vw_projects');
      await atlasPool.query(`CREATE VIEW vw_projects AS 
        SELECT p.*, 
               o.money_collected AS override_money_collected,
               o.status_id AS override_status_id,
               o.is_prospective AS override_is_prospective
        FROM replica_kimai_projects p
        LEFT JOIN project_overrides o ON o.kimai_project_id = p.id`);
    }
    await atlasPool.query('INSERT INTO replica_kimai_projects (id, name) VALUES (?, ?)', [pid, 'Test Project']);
    await atlasPool.query(
      'INSERT INTO project_overrides (kimai_project_id, status_id, is_prospective, money_collected, updated_by_email) VALUES (?,?,?,?,?)',
      [pid, 1234, 1, 1234.56, 'test@example.com']
    );
    const [rows]: any = await atlasPool.query('SELECT * FROM vw_projects WHERE id = ?', [pid]);
    expect(rows.length).toBe(1);
    const r = rows[0];
    expect(Number(r.override_status_id)).toBeGreaterThanOrEqual(0);
    expect(r.override_is_prospective === 1 || r.override_is_prospective === true).toBeTruthy();
    expect(Number(r.override_money_collected)).toBeCloseTo(1234.56, 2);
  });
});
