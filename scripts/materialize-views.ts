import 'dotenv/config';
import { atlasPool } from '../db';

async function tableExists(name: string): Promise<boolean> {
  const [rows]: any = await atlasPool.query(
    'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1',
    [name]
  );
  return rows.length > 0;
}

async function materialize(viewName: string, tableName: string) {
  console.log(`[materialize] ${viewName} -> ${tableName}`);
  const stg = `${tableName}_stg`;
  await atlasPool.query(`DROP TABLE IF EXISTS \`${stg}\``);
  // Build staging from view
  await atlasPool.query(`CREATE TABLE \`${stg}\` AS SELECT * FROM \`${viewName}\``);
  if (await tableExists(tableName)) {
    const old = `${tableName}_old`;
    await atlasPool.query(`RENAME TABLE \`${tableName}\` TO \`${old}\`, \`${stg}\` TO \`${tableName}\``);
    await atlasPool.query(`DROP TABLE IF EXISTS \`${old}\``);
  } else {
    await atlasPool.query(`RENAME TABLE \`${stg}\` TO \`${tableName}\``);
  }
  console.log(`[materialize] swapped ${tableName}`);
}

async function main() {
  await materialize('vw_projects', 'mat_projects');
  await materialize('vw_timesheet_facts', 'mat_timesheet_facts');
  await atlasPool.end();
}

main().catch((e) => {
  console.error('[materialize] Failed:', e?.message || e);
  process.exit(1);
});

