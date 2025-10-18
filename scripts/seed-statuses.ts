import 'dotenv/config';
import { StatusService } from '../src/services/statusService';

async function main() {
  await StatusService.ensureSchema();
  const existing = await StatusService.list();
  if (existing.length) {
    console.log(`[seed-statuses] Skipping: ${existing.length} statuses already present.`);
    return;
  }
  const defaults = [
    { name: 'Unassigned', code: 'unassigned', sort_order: 10 },
    { name: 'Schematic Design', code: 'schematic', sort_order: 20 },
    { name: 'Design Development', code: 'design-dev', sort_order: 30 },
    { name: 'Tender', code: 'tender', sort_order: 40 },
    { name: 'Under construction', code: 'under-construction', sort_order: 50 },
    { name: 'Post construction', code: 'post-construction', sort_order: 60 },
    { name: 'KIV', code: 'kiv', sort_order: 70 },
    { name: 'Others', code: 'others', sort_order: 80 },
  ];
  for (const s of defaults) {
    await StatusService.create(s);
    console.log(`[seed-statuses] Created: ${s.name}`);
  }
  console.log('[seed-statuses] Done.');
}

main().catch((e) => { console.error('[seed-statuses] Failed:', e?.message || e); process.exit(1); });

