import 'dotenv/config';
import { db } from '../src/db/client';
import { atlasPool } from '../db';
import { roles, permissions, rolePermissions, studios, studioTeams, studioDirectors } from '../src/db/schema';
import { sql, inArray, eq } from 'drizzle-orm';
import { StatusService } from '../src/services/statusService';

async function upsertRoles(entries: Array<{ code: string; name: string }>) {
  for (const e of entries) {
    await db
      .insert(roles)
      .values({ code: e.code, name: e.name })
      .onDuplicateKeyUpdate({ set: { name: sql`VALUES(name)` } });
  }
  const codes = entries.map(e => e.code)
  const rows = await db.select().from(roles).where(inArray(roles.code, codes));
  return Object.fromEntries(rows.map(r => [r.code, r.id]));
}

async function upsertPermissions(names: string[]) {
  for (const name of names) {
    await db
      .insert(permissions)
      .values({ name })
      .onDuplicateKeyUpdate({ set: { name: sql`VALUES(name)` } });
  }
  const rows = await db.select().from(permissions).where(inArray(permissions.name, names));
  return Object.fromEntries(rows.map(r => [r.name, r.id]));
}

async function mapRolePermissions(roleMap: Record<string, number>, permMap: Record<string, number>, grants: Record<string, string[]>) {
  const rows: { roleId: number; permissionId: number }[] = [];
  for (const [roleName, perms] of Object.entries(grants)) {
    const roleId = roleMap[roleName];
    if (!roleId) continue;
    for (const p of perms) {
      const permissionId = permMap[p];
      if (!permissionId) continue;
      rows.push({ roleId, permissionId });
    }
  }
  for (const chunk of chunked(rows, 100)) {
    await db
      .insert(rolePermissions)
      .values(chunk.map(rp => ({ roleId: rp.roleId, permissionId: rp.permissionId })))
      // No-op update on duplicate composite key
      .onDuplicateKeyUpdate({ set: { roleId: sql`role_id`, permissionId: sql`permission_id` } });
  }
}

function chunked<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const roleEntries = [
    { code: 'hr', name: 'Human Resource' },
    { code: 'management', name: 'Management' },
    { code: 'directors', name: 'Directors' },
    { code: 'admins', name: 'Administrator' },
  ];
  const permNames = ['*', 'project:read', 'timesheet:read', 'bi:read', 'overrides:update', 'sync:execute', 'rbac:admin', 'payments:view', 'payments:create'];

  const roleMap = await upsertRoles(roleEntries);
  const permMap = await upsertPermissions(permNames);

  const grants: Record<string, string[]> = {
    hr: ['project:read', 'timesheet:read', 'bi:read', 'overrides:update', 'payments:view', 'payments:create'],
    management: ['project:read', 'timesheet:read', 'bi:read', 'payments:view'],
    directors: ['project:read', 'timesheet:read', 'bi:read', 'overrides:update', 'payments:view', 'payments:create'],
    admins: ['*'],
  };

  await mapRolePermissions(roleMap, permMap, grants);
  console.log('Seeded roles, permissions, and role-permission mappings.');

  // Project statuses (idempotent); unified here (replaces separate seed-statuses script)
  try {
    await StatusService.ensureSchema();
    const existing = await StatusService.list();
    if (existing.length) {
      console.log(`[seed] Skipping statuses: ${existing.length} already present.`);
    } else {
      const defaults = [
        { name: 'Unassigned', code: 'unassigned', color: '#6b7280', sort_order: 10 },
        { name: 'Schematic Design', code: 'schematic', color: '#3b82f6', sort_order: 20 },
        { name: 'Design Development', code: 'design-dev', color: '#6366f1', sort_order: 30 },
        { name: 'Tender', code: 'tender', color: '#a78bfa', sort_order: 40 },
        { name: 'Under construction', code: 'under-construction', color: '#f59e0b', sort_order: 50 },
        { name: 'Post construction', code: 'post-construction', color: '#10b981', sort_order: 60 },
        { name: 'KIV', code: 'kiv', color: '#ef4444', sort_order: 70 },
        { name: 'Others', code: 'others', color: '#9ca3af', sort_order: 80 },
      ];
      for (const s of defaults) {
        await StatusService.create(s);
        console.log(`[seed] status created: ${s.name}`);
      }
      console.log('[seed] Seeded default project statuses.');
    }
  } catch (e: any) {
    console.warn('[seed] Status seeding skipped:', e?.message || e);
  }

  // Studios and initial mappings
  try {
    const studioDefs: Array<{ name: string; teamIds: number[]; directorIds: number[] }> = [
      { name: 'Studio One', teamIds: [46,47,48,49,50,51,52,53,54,55,57,60,61,62], directorIds: [17] },
      { name: 'Studio Two', teamIds: [34,35,36,37,38,39,45], directorIds: [55] },
      { name: 'Studio Three', teamIds: [22,23,24,25,26,27,28,44], directorIds: [58] },
    ];

    // Upsert studios by name
    for (const s of studioDefs) {
      await db
        .insert(studios)
        .values({ name: s.name })
        .onDuplicateKeyUpdate({ set: { name: sql`VALUES(name)` } });
    }
    // Read back ids
    const created = await db.select().from(studios);
    const idByName = new Map(created.map(s => [s.name as string, s.id as number]));

    // Seed mappings (use no-op on duplicate to emulate INSERT IGNORE)
    const teamRows: Array<{ studioId: number; kimaiTeamId: number }> = [];
    const directorRows: Array<{ studioId: number; replicaKimaiUserId: number }> = [];
    for (const s of studioDefs) {
      const sid = idByName.get(s.name);
      if (!sid) continue;
      for (const tid of s.teamIds) teamRows.push({ studioId: sid, kimaiTeamId: tid });
      for (const uid of s.directorIds) directorRows.push({ studioId: sid, replicaKimaiUserId: uid });
    }
    for (const chunk of chunked(teamRows, 100)) {
      await db
        .insert(studioTeams)
        .values(chunk)
        .onDuplicateKeyUpdate({ set: { studioId: sql`studio_id`, kimaiTeamId: sql`kimai_team_id` } });
    }
    for (const chunk of chunked(directorRows, 100)) {
      await db
        .insert(studioDirectors)
        .values(chunk)
        .onDuplicateKeyUpdate({ set: { studioId: sql`studio_id`, replicaKimaiUserId: sql`replica_kimai_user_id` } });
    }
    console.log('[seed] Seeded studios, teams, and directors.');
  } catch (e: any) {
    console.warn('[seed] Studios seeding skipped:', e?.message || e);
  }
}

main()
  .then(async () => {
    try { await atlasPool.end(); } catch {}
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    try { await atlasPool.end(); } catch {}
    process.exit(1);
  });
