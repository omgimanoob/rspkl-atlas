import 'dotenv/config';
import { kimaiPool, atlasPool } from '../db';
import { syncUsersTeams } from '../src/services/teamsSync';

async function main() {
  console.log('[sync:teams:users] Full refresh (staging-and-swap)');
  const total = await syncUsersTeams();
  console.log(`[sync:teams:users] Swap complete. Rows: ${total}`);
  await kimaiPool.end();
  await atlasPool.end();
}

main().catch((e) => { console.error('[sync:teams:users] Failed:', e?.message || e); process.exit(1); });
