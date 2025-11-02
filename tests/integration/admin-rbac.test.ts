import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import { users, roles, userRoles, permissions, rolePermissions, permissionGrants, rbacAuditLogs } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

jest.setTimeout(30000);

async function ensureRole(code: string, displayName?: string) {
  await db.insert(roles).values({ code, name: displayName || code }).onDuplicateKeyUpdate({ set: { name: displayName || code } });
  return db.select({ id: roles.id, code: roles.code, name: roles.name }).from(roles).where(eq(roles.code, code)).limit(1).then(r => r[0]);
}

async function ensurePermission(name: string) {
  await db.insert(permissions).values({ name }).onDuplicateKeyUpdate({ set: { name } });
  return db.select({ id: permissions.id, name: permissions.name }).from(permissions).where(eq(permissions.name, name)).limit(1).then(r => r[0]);
}

async function mapRolePermission(roleId: number, permissionId: number) {
  await db.insert(rolePermissions).values({ roleId, permissionId }).onDuplicateKeyUpdate({ set: { roleId, permissionId } });
}

async function createUser(email: string, password: string, roleNames: string[] = []) {
  const hash = await bcrypt.hash(password, 12);
  await db.insert(users).values({ email, passwordHash: hash, displayName: 'Admin Test', isActive: 1 }).onDuplicateKeyUpdate({ set: { email } });
  const user = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0]);
  for (const rn of roleNames) {
    const role = await ensureRole(rn);
    await db.insert(userRoles).values({ userId: user.id, roleId: role.id }).onDuplicateKeyUpdate({ set: { userId: user.id, roleId: role.id } });
  }
  return user;
}

async function deleteUser(email: string) {
  const u = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0]);
  if (u) {
    await db.delete(userRoles).where(eq(userRoles.userId, u.id));
    await db.delete(permissionGrants).where(eq(permissionGrants.subjectId, u.id));
    await db.delete(users).where(eq(users.id, u.id));
  }
}

describe('Admin RBAC APIs', () => {
  const adminAgent = request.agent(app);
  const userAgent = request.agent(app);
  const adminEmail = 'rbac.admin@example.com';
  const basicEmail = 'rbac.basic@example.com';
  const pwd = 'Secret123!';
  let createdRoleId: number;
  let createdPermId: number;
  let targetUserId: number;

  beforeAll(async () => {
    // Ensure admins role has rbac:admin permission
    const admins = await ensureRole('admins');
    const p = await ensurePermission('rbac:admin');
    await mapRolePermission(admins.id, p.id);
    // Create admin user with admins role
    await createUser(adminEmail, pwd, ['admins']);
    await adminAgent.post('/api/auth/login').send({ email: adminEmail, password: pwd }).expect(200);
    // Non-admin user
    await createUser(basicEmail, pwd, []);
    await userAgent.post('/api/auth/login').send({ email: basicEmail, password: pwd }).expect(200);
  });

  afterAll(async () => {
    // Cleanup created role/permission via API if present
    if (createdRoleId) {
      await adminAgent.delete(`/api/admin/rbac/roles/${createdRoleId}`).expect(200);
    }
    if (createdPermId) {
      await adminAgent.delete(`/api/admin/rbac/permissions/${createdPermId}`).expect(200);
    }
    if (targetUserId) {
      // Best effort cleanup of target user DB rows
      const u = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, targetUserId)).limit(1).then(r => r[0]);
      if (u) await deleteUser(u.email);
    }
    await deleteUser(adminEmail);
    await deleteUser(basicEmail);
  });

  it('creates and lists roles', async () => {
    const roleCode = `qa_${Date.now()}`;
    const roleName = `QA ${Date.now()}`;
    const create = await adminAgent.post('/api/admin/rbac/roles').send({ code: roleCode, name: roleName }).expect(201);
    expect(create.body.code).toBe(roleCode);
    expect(create.body.name).toBe(roleName);
    createdRoleId = create.body.id;
    const list = await adminAgent.get('/api/admin/rbac/roles').expect(200);
    expect(list.body.some((r: any) => r.code === roleCode && r.name === roleName)).toBe(true);
    // Audit log exists for mutation
    const audits = await db.select().from(rbacAuditLogs).then(r => r);
    expect(audits.some(a => a.route?.includes('/api/admin/rbac/roles') && a.method === 'POST')).toBe(true);
  });

  it('creates and lists permissions', async () => {
    const permName = `feature:test:${Date.now()}`;
    const create = await adminAgent.post('/api/admin/rbac/permissions').send({ name: permName }).expect(201);
    expect(create.body.name).toBe(permName);
    createdPermId = create.body.id;
    const list = await adminAgent.get('/api/admin/rbac/permissions').expect(200);
    expect(list.body.some((p: any) => p.name === permName)).toBe(true);
  });

  it('maps permission to role', async () => {
    // createdRoleId and createdPermId set by previous tests
    await adminAgent.post(`/api/admin/rbac/roles/${createdRoleId}/permissions/${createdPermId ? (await db.select({ name: permissions.name }).from(permissions).where(eq(permissions.id, createdPermId)).limit(1).then(r => r[0].name)) : 'rbac:admin'}`).expect(200);
  });

  it('assigns role to a user', async () => {
    const target = await createUser(`rbac.user.${Date.now()}@example.com`, pwd, []);
    targetUserId = target.id;
    const role = await db.select({ code: roles.code }).from(roles).where(eq(roles.id, createdRoleId)).limit(1).then(r => r[0]);
    await adminAgent.post(`/api/admin/rbac/users/${targetUserId}/roles/${role.code}`).expect(200);
  });

  it('creates, lists and deletes a scoped grant', async () => {
    // dry run
    await adminAgent
      .post('/api/admin/rbac/grants?dryRun=true')
      .send({ subject_type: 'user', subject_id: targetUserId, permission: 'overrides:update', resource_type: 'project', resource_id: 777 })
      .expect(200);

    // create
    await adminAgent
      .post('/api/admin/rbac/grants')
      .send({ subject_type: 'user', subject_id: targetUserId, permission: 'overrides:update', resource_type: 'project', resource_id: 777 })
      .expect(201);

    // list
    const list = await adminAgent.get('/api/admin/rbac/grants').expect(200);
    const grant = list.body.find((g: any) => g.subjectId === targetUserId && g.permission === 'overrides:update');
    expect(grant).toBeTruthy();

    // delete
    await adminAgent.delete(`/api/admin/rbac/grants/${grant.id}`).expect(200);
    const audits = await db.select().from(rbacAuditLogs).then(r => r);
    expect(audits.some(a => a.route?.includes('/api/admin/rbac/grants') && a.method === 'POST')).toBe(true);
    expect(audits.some(a => a.route?.includes('/api/admin/rbac/grants') && a.method === 'DELETE')).toBe(true);
  });

  it('rejects invalid resource_type/resource_id on grant creation', async () => {
    // invalid resource_type
    await adminAgent
      .post('/api/admin/rbac/grants')
      .send({ subject_type: 'user', subject_id: targetUserId, permission: 'overrides:update', resource_type: 'unknown', resource_id: 1 })
      .expect(400);
    // invalid resource_id
    await adminAgent
      .post('/api/admin/rbac/grants')
      .send({ subject_type: 'user', subject_id: targetUserId, permission: 'overrides:update', resource_type: 'project', resource_id: 'abc' })
      .expect(400);
  });

  it('denies non-admin access to admin endpoints', async () => {
    await userAgent.get('/api/admin/rbac/roles').expect(403);
    await userAgent.post('/api/admin/rbac/roles').send({ name: 'nope' }).expect(403);
  });

  it('validation errors: invalid role/permission names and ids', async () => {
    await adminAgent.post('/api/admin/rbac/roles').send({}).expect(400);
    await adminAgent.post('/api/admin/rbac/permissions').send({}).expect(400);
    await adminAgent.post(`/api/admin/rbac/roles/abc/permissions/whatever`).expect(400);
    await adminAgent.post(`/api/admin/rbac/roles/${createdRoleId}/permissions/does:not:exist`).expect(404);
    await adminAgent.post(`/api/admin/rbac/users/abc/roles/${Date.now()}`).expect(400);
    await adminAgent.post(`/api/admin/rbac/users/123456/roles/does-not-exist`).expect(404);
  });

  it('explicitly removes permission from role and role from user (and audits)', async () => {
    // Create temp permission and map to createdRoleId
    const tempName = `temp:perm:${Date.now()}`;
    const createdPerm = await adminAgent.post('/api/admin/rbac/permissions').send({ name: tempName }).expect(201);
    await adminAgent.post(`/api/admin/rbac/roles/${createdRoleId}/permissions/${tempName}`).expect(200);
    await adminAgent.delete(`/api/admin/rbac/roles/${createdRoleId}/permissions/${tempName}`).expect(200);

    const role = await db.select({ code: roles.code }).from(roles).where(eq(roles.id, createdRoleId)).limit(1).then(r => r[0]);
    await adminAgent.delete(`/api/admin/rbac/users/${targetUserId}/roles/${role.code}`).expect(200);

    const audits = await db.select().from(rbacAuditLogs).then(r => r);
    expect(audits.some(a => a.route?.includes('/api/admin/rbac/roles') && a.method === 'DELETE')).toBe(true);
    expect(audits.some(a => a.route?.includes('/api/admin/rbac/users') && a.method === 'DELETE')).toBe(true);

    // Cleanup: delete the temp permission to avoid test data accumulation
    try {
      const list = await adminAgent.get('/api/admin/rbac/permissions').expect(200);
      const found = Array.isArray(list.body) ? list.body.find((p: any) => p.name === tempName) : null;
      const pid = found?.id ?? createdPerm.body?.id;
      if (pid) {
        await adminAgent.delete(`/api/admin/rbac/permissions/${pid}`).expect(200);
      }
    } catch {}
  });
});
