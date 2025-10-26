import 'dotenv/config';
import { kimaiPool, atlasPool } from '../db';
import { ProjectsSync } from '../src/services/projectsSync';

async function main() {
  console.log('[sync:projects] Starting full refresh (staging-and-swap)');
  const total = await ProjectsSync.run();
  console.log(`[sync:projects] Swap complete. Rows: ${total}`);
  await kimaiPool.end();
  await atlasPool.end();
}

main().catch((e) => {
  console.error('[sync:projects] Failed:', e?.message || e);
  process.exit(1);
});
