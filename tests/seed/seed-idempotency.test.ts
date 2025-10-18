import { db } from '../../src/db/client';
import { roles, permissions, rolePermissions } from '../../src/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function upsertRoles(names: string[]) {
  for (const name of names) {
    await db.insert(roles).values({ name }).onDuplicateKeyUpdate({ set: { name } });
  }
}

async function upsertPermissions(names: string[]) {
  for (const name of names) {
    await db.insert(permissions).values({ name }).onDuplicateKeyUpdate({ set: { name } });
  }
}

describe('Seed idempotency (subset)', () => {
  const roleNames = ['hr', 'management', 'directors', 'admins'];
  const permNames = ['*', 'project:read', 'timesheet:read', 'bi:read', 'overrides:update', 'sync:execute', 'rbac:admin'];

  it('roles and permissions upserts do not create duplicates', async () => {
    const beforeRoles = await db.select().from(roles).where(inArray(roles.name, roleNames));
    const beforePerms = await db.select().from(permissions).where(inArray(permissions.name, permNames));

    await upsertRoles(roleNames);
    await upsertPermissions(permNames);

    const afterRoles = await db.select().from(roles).where(inArray(roles.name, roleNames));
    const afterPerms = await db.select().from(permissions).where(inArray(permissions.name, permNames));

    expect(afterRoles.length).toBeGreaterThanOrEqual(beforeRoles.length);
    expect(afterRoles.length).toBe(roleNames.length);
    expect(afterPerms.length).toBeGreaterThanOrEqual(beforePerms.length);
    expect(afterPerms.length).toBe(permNames.length);
  });

  it('role-permission mapping upserts are idempotent for admins → *', async () => {
    // Find ids
    const admins = await db.select().from(roles).where(eq(roles.name, 'admins')).limit(1).then(r => r[0]);
    const star = await db.select().from(permissions).where(eq(permissions.name, '*')).limit(1).then(r => r[0]);
    const before = await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, admins.id));

    await db.insert(rolePermissions).values({ roleId: admins.id, permissionId: star.id }).onDuplicateKeyUpdate({ set: { roleId: admins.id, permissionId: star.id } });
    const after = await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, admins.id));

    expect(after.length).toBeGreaterThanOrEqual(before.length);
    // Ensure at least the mapping exists only once
    const matches = after.filter(rp => rp.permissionId === star.id);
    expect(matches.length).toBe(1);
  });
});

