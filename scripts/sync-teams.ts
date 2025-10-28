import 'dotenv/config';
import { kimaiPool, atlasPool } from '../db';
import { syncTeams } from '../src/services/teamsSync';

async function main() {
  console.log('[sync:teams] Full refresh (staging-and-swap)');
  const total = await syncTeams();
  console.log(`[sync:teams] Swap complete. Rows: ${total}`);
  await kimaiPool.end();
  await atlasPool.end();
}

main().catch((e) => { console.error('[sync:teams] Failed:', e?.message || e); process.exit(1); });
