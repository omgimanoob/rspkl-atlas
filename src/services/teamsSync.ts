import { atlasPool, kimaiPool } from '../../db';

async function createStaging(live: string, stg: string) {
  await atlasPool.query(`DROP TABLE IF EXISTS \`${stg}\``);
  await atlasPool.query(`CREATE TABLE \`${stg}\` LIKE \`${live}\``);
}

async function swapTables(live: string, stg: string) {
  const old = `${live}_old`;
  await atlasPool.query(`RENAME TABLE \`${live}\` TO \`${old}\`, \`${stg}\` TO \`${live}\``);
  await atlasPool.query(`DROP TABLE IF EXISTS \`${old}\``);
}

export async function syncTeams(): Promise<number> {
  const live = 'replica_kimai_teams';
  const stg = 'replica_kimai_teams_stg';
  await atlasPool.query(`CREATE TABLE IF NOT EXISTS \`${live}\` (
    \`id\` int NOT NULL,
    \`name\` varchar(100),
    \`color\` varchar(7),
    \`synced_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(\`id\`)
  )`);
  await createStaging(live, stg);
  const [rows]: any = await kimaiPool.query('SELECT id, name, color FROM kimai2_teams ORDER BY id');
  if (rows.length) {
    const cols = ['id','name','color'];
    const ph = '(' + cols.map(() => '?').join(',') + ')';
    const values: any[] = [];
    for (const r of rows) values.push(r.id, r.name, r.color);
    const sql = `INSERT INTO \`${stg}\` (${cols.join(',')}) VALUES ${rows.map(() => ph).join(',')}`;
    await atlasPool.query(sql, values);
  }
  await swapTables(live, stg);
  await atlasPool.query(
    'INSERT INTO sync_state (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value=VALUES(state_value), updated_at=CURRENT_TIMESTAMP',
    ['sync.teams.last_run', new Date().toISOString()]
  );
  return rows.length as number;
}

export async function syncUsersTeams(): Promise<number> {
  const live = 'replica_kimai_users_teams';
  const stg = 'replica_kimai_users_teams_stg';
  await atlasPool.query(`CREATE TABLE IF NOT EXISTS \`${live}\` (
    \`id\` int NOT NULL,
    \`user_id\` int NOT NULL,
    \`team_id\` int NOT NULL,
    \`teamlead\` tinyint(1) NOT NULL DEFAULT 0,
    \`synced_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(\`id\`),
    INDEX \`ix_replica_users_teams_user\` (\`user_id\`),
    INDEX \`ix_replica_users_teams_team\` (\`team_id\`)
  )`);
  await createStaging(live, stg);
  const [rows]: any = await kimaiPool.query('SELECT id, user_id, team_id, teamlead FROM kimai2_users_teams ORDER BY id');
  if (rows.length) {
    const cols = ['id','user_id','team_id','teamlead'];
    const ph = '(' + cols.map(() => '?').join(',') + ')';
    const values: any[] = [];
    for (const r of rows) values.push(r.id, r.user_id, r.team_id, r.teamlead);
    const sql = `INSERT INTO \`${stg}\` (${cols.join(',')}) VALUES ${rows.map(() => ph).join(',')}`;
    await atlasPool.query(sql, values);
  }
  await swapTables(live, stg);
  await atlasPool.query(
    'INSERT INTO sync_state (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value=VALUES(state_value), updated_at=CURRENT_TIMESTAMP',
    ['sync.teams_users.last_run', new Date().toISOString()]
  );
  return rows.length as number;
}

