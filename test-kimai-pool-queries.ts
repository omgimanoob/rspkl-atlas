import { kimaiPool } from './db';

async function main() {
  console.log('[kimai:teams] Listing teams from Kimai DB...');
  try {
    const [rows]: any = await kimaiPool.query(
      `SELECT 
         t.id, t.name, t.color,
         COALESCE(GROUP_CONCAT(u.username ORDER BY u.username SEPARATOR ', '), '') AS leaders
       FROM kimai2_teams t
       LEFT JOIN kimai2_users_teams ut ON ut.team_id = t.id AND ut.teamlead = 1
       LEFT JOIN kimai2_users u ON u.id = ut.user_id
       GROUP BY t.id, t.name, t.color
       ORDER BY t.name ASC`
    );
    if (!rows || rows.length === 0) {
      console.log('[kimai:teams] No teams found.');
    } else {
      for (const r of rows) {
        const id = r.id;
        const name = r.name;
        const color = r.color || '';
        const leaders = (r.leaders || '').trim();
        console.log(`${id}\t${name}${color ? `\t${color}` : '\t'}\t${leaders || '-'}`);
      }
      console.log(`[kimai:teams] Total: ${rows.length}`);
    }
  } catch (e: any) {
    console.error('[kimai:teams] Error querying teams:', e?.message || e);
    process.exitCode = 1;
  } finally {
    try { await kimaiPool.end(); } catch {}
  }
}

main();
