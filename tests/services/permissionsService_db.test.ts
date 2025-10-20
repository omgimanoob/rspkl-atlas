import { db } from '../../src/db/client';
import { users, permissions, userPermissions, permissionGrants, roles, rolePermissions, userRoles } from '../../src/db/schema';
import { PermissionsService } from '../../src/services/permissionsService';
import { eq } from 'drizzle-orm';

describe('PermissionsService (DB-backed cases)', () => {
  const email = `ut.perm.${Date.now()}@example.com`;
  const userRecord = { email, passwordHash: 'x', isActive: 1, displayName: 'Perm Test' as any };
  let userId: number;

  async function ensurePermission(name: string) {
    await db.insert(permissions).values({ name }).onDuplicateKeyUpdate({ set: { name } });
    const p = await db.select({ id: permissions.id }).from(permissions).where(eq(permissions.name, name)).limit(1).then(r => r[0]);
    return p.id as number;
  }

  beforeAll(async () => {
    await db.insert(users).values(userRecord);
    const u = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0]);
    userId = u.id;
  });

  afterAll(async () => {
    await db.delete(userPermissions).where(eq(userPermissions.userId, userId));
    await db.delete(permissionGrants).where(eq(permissionGrants.subjectId, userId));
    await db.delete(userRoles).where(eq(userRoles.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  it('direct user permission allows access', async () => {
    const pname = `custom:test:${Date.now()}`;
    const pid = await ensurePermission(pname);
    await db.insert(userPermissions).values({ userId, permissionId: pid }).onDuplicateKeyUpdate({ set: { userId, permissionId: pid } });
    const decision = await PermissionsService.hasPermission({ id: userId, email, roles: [] }, pname);
    expect(decision.allow).toBe(true);
  });

  it('scoped grant allows only on matching resource', async () => {
    const pname = 'overrides:update';
    // No need to ensure permission row by name for grants since we store name directly in permissionGrants
    await db.insert(permissionGrants).values({
      subjectType: 'user',
      subjectId: userId,
      permission: pname,
      resourceType: 'project',
      resourceId: 555,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const allow = await PermissionsService.hasPermission({ id: userId, email, roles: [] }, pname, { resource_type: 'project', resource_id: 555 });
    const deny = await PermissionsService.hasPermission({ id: userId, email, roles: [] }, pname, { resource_type: 'project', resource_id: 777 });
    expect(allow.allow).toBe(true);
    expect(deny.allow).toBe(false);
  });

  it('expired grant is ignored', async () => {
    const pname = 'overrides:update';
    await db.insert(permissionGrants).values({
      subjectType: 'user',
      subjectId: userId,
      permission: pname,
      resourceType: 'project',
      resourceId: 999,
      expiresAt: new Date(Date.now() - 24 * 3600 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const dec = await PermissionsService.hasPermission({ id: userId, email, roles: [] }, pname, { resource_type: 'project', resource_id: 999 });
    expect(dec.allow).toBe(false);
  });

  it('role-derived permission allows access', async () => {
    const pname = 'project:read';
    // ensure permission and a test role; map and assign to user
    const pid = await ensurePermission(pname);
    await db.insert(roles).values({ code: 'perm_test_role', name: 'Permission Test Role' }).onDuplicateKeyUpdate({ set: { name: 'Permission Test Role' } });
    const role = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, 'perm_test_role')).limit(1).then(r => r[0]);
    await db.insert(rolePermissions).values({ roleId: role.id, permissionId: pid }).onDuplicateKeyUpdate({ set: { roleId: role.id, permissionId: pid } });
    await db.insert(userRoles).values({ userId, roleId: role.id }).onDuplicateKeyUpdate({ set: { userId, roleId: role.id } });
    const decision = await PermissionsService.hasPermission({ id: userId, email, roles: ['perm_test_role'] }, pname);
    expect(decision.allow).toBe(true);
  });

  it('unknown permission denies access', async () => {
    const decision = await PermissionsService.hasPermission({ id: userId, email, roles: [] }, 'does:not:exist');
    expect(decision.allow).toBe(false);
  });
});
