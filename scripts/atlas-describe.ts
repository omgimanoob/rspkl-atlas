import 'dotenv/config';
import { atlasPool } from '../db';

async function main() {
  const [rows]: any = await atlasPool.query(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name'
  );
  console.log('[atlas:tables]', rows.map((r: any) => r.table_name || r.TABLE_NAME));
  await atlasPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });

