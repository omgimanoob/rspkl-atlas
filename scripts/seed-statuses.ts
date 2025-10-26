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
    { name: 'Unassigned', code: 'unassigned', color: '#6b7280', sort_order: 10 }, // gray-500
    { name: 'Schematic Design', code: 'schematic', color: '#3b82f6', sort_order: 20 }, // blue-500
    { name: 'Design Development', code: 'design-dev', color: '#6366f1', sort_order: 30 }, // indigo-500
    { name: 'Tender', code: 'tender', color: '#a78bfa', sort_order: 40 }, // violet-400
    { name: 'Under construction', code: 'under-construction', color: '#f59e0b', sort_order: 50 }, // amber-500
    { name: 'Post construction', code: 'post-construction', color: '#10b981', sort_order: 60 }, // emerald-500
    { name: 'KIV', code: 'kiv', color: '#ef4444', sort_order: 70 }, // red-500
    { name: 'Others', code: 'others', color: '#9ca3af', sort_order: 80 }, // gray-400
  ];
  for (const s of defaults) {
    await StatusService.create(s);
    console.log(`[seed-statuses] Created: ${s.name}`);
  }
  console.log('[seed-statuses] Done.');
}

main().catch((e) => { console.error('[seed-statuses] Failed:', e?.message || e); process.exit(1); });
