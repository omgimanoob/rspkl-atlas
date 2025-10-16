import 'dotenv/config';
import { db } from '../src/db/client';
import { roles, permissions, rolePermissions } from '../src/db/schema';
import { sql, inArray, eq } from 'drizzle-orm';

async function upsertRoles(names: string[]) {
  for (const name of names) {
    await db
      .insert(roles)
      .values({ name })
      .onDuplicateKeyUpdate({ set: { name: sql`VALUES(name)` } });
  }
  const rows = await db.select().from(roles).where(inArray(roles.name, names));
  return Object.fromEntries(rows.map(r => [r.name, r.id]));
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
  const roleNames = ['hr', 'management', 'directors', 'admins'];
  const permNames = ['project:read', 'timesheet:read', 'bi:read', 'overrides:update', 'sync:execute', 'rbac:admin'];

  const roleMap = await upsertRoles(roleNames);
  const permMap = await upsertPermissions(permNames);

  const grants: Record<string, string[]> = {
    hr: ['project:read', 'timesheet:read', 'bi:read', 'overrides:update'],
    management: ['project:read', 'timesheet:read', 'bi:read'],
    directors: ['project:read', 'timesheet:read', 'bi:read', 'overrides:update'],
    admins: ['project:read', 'timesheet:read', 'bi:read', 'overrides:update', 'sync:execute', 'rbac:admin'],
  };

  await mapRolePermissions(roleMap, permMap, grants);
  console.log('Seeded roles, permissions, and role-permission mappings.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
