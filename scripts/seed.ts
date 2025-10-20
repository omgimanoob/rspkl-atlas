import 'dotenv/config';
import { db } from '../src/db/client';
import { roles, permissions, rolePermissions } from '../src/db/schema';
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
  const permNames = ['*', 'project:read', 'timesheet:read', 'bi:read', 'overrides:update', 'sync:execute', 'rbac:admin'];

  const roleMap = await upsertRoles(roleEntries);
  const permMap = await upsertPermissions(permNames);

  const grants: Record<string, string[]> = {
    hr: ['project:read', 'timesheet:read', 'bi:read', 'overrides:update'],
    management: ['project:read', 'timesheet:read', 'bi:read'],
    directors: ['project:read', 'timesheet:read', 'bi:read', 'overrides:update'],
    admins: ['*'],
  };

  await mapRolePermissions(roleMap, permMap, grants);
  console.log('Seeded roles, permissions, and role-permission mappings.');

  // Also seed project statuses if the table is empty (idempotent)
  try {
    await StatusService.ensureSchema();
    const existing = await StatusService.list();
    if (!existing.length) {
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
        console.log(`[seed] status created: ${s.name}`);
      }
      console.log('Seeded default project statuses.');
    } else {
      console.log(`[seed] Skipped statuses: ${existing.length} already present.`);
    }
  } catch (e: any) {
    console.warn('[seed] Status seeding skipped:', e?.message || e);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
