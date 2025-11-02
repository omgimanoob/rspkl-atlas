import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import { users, roles, permissions, rolePermissions, userRoles } from '../../src/db/schema';
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

async function createUserDirect(email: string, password: string, roleNames: string[] = []) {
  const hash = await bcrypt.hash(password, 12);
  await db.insert(users).values({ email, passwordHash: hash, displayName: 'Test', isActive: 1 }).onDuplicateKeyUpdate({ set: { email } });
  const user = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0]);
  for (const rn of roleNames) {
    const role = await ensureRole(rn);
    await db.insert(userRoles).values({ userId: user.id, roleId: role.id }).onDuplicateKeyUpdate({ set: { userId: user.id, roleId: role.id } });
  }
  return user;
}

async function deleteUserByEmail(email: string) {
  const u = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0]);
  if (u) {
    await db.delete(userRoles).where(eq(userRoles.userId, u.id));
    await db.delete(users).where(eq(users.id, u.id));
  }
}

describe('Admin Users APIs', () => {
  const adminAgent = request.agent(app);
  const userAgent = request.agent(app);
  const adminEmail = `admin.${Date.now()}@example.com`;
  const basicEmail = `basic.${Date.now()}@example.com`;
  const pwd = 'Secret123!';
  let createdUserId: number;

  beforeAll(async () => {
    // Ensure admins role has rbac:admin permission
    const admins = await ensureRole('admins');
    const p = await ensurePermission('rbac:admin');
    await mapRolePermission(admins.id, p.id);
    // Create admin user with admins role
    await createUserDirect(adminEmail, pwd, ['admins']);
    await adminAgent.post('/api/auth/login').send({ email: adminEmail, password: pwd }).expect(200);
    // Non-admin user
    await createUserDirect(basicEmail, pwd, []);
    await userAgent.post('/api/auth/login').send({ email: basicEmail, password: pwd }).expect(200);
  });

  afterAll(async () => {
    // Cleanup created target user
    if (createdUserId) {
      const u = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, createdUserId)).limit(1).then(r => r[0]);
      if (u) await deleteUserByEmail(u.email);
    }
    await deleteUserByEmail(adminEmail);
    await deleteUserByEmail(basicEmail);
  });

  it('denies non-admin access', async () => {
    await userAgent.get('/api/admin/users').expect(403);
    await userAgent.post('/api/admin/users').send({ email: 'x@y.com', password: 'Secret!' }).expect(403);
  });

  it('creates a user', async () => {
    const email = `user.${Date.now()}@example.com`;
    const resp = await adminAgent.post('/api/admin/users').send({ email, password: 'ChangeMe1', display_name: 'Alpha', is_active: true }).expect(201);
    expect(resp.body.email).toBe(email.toLowerCase());
    expect(resp.body.display_name).toBe('Alpha');
    expect(resp.body.is_active).toBe(true);
    createdUserId = resp.body.id;
  });

  it('rejects invalid payloads', async () => {
    await adminAgent.post('/api/admin/users').send({}).expect(400);
    await adminAgent.post('/api/admin/users').send({ email: 'not-an-email', password: 'short' }).expect(400);
    await adminAgent.post('/api/admin/users').send({ email: 'ok@example.com', password: 'ChangeMe1', is_active: 'yes' }).expect(400);
  });

  it('lists users with pagination', async () => {
    const list = await adminAgent.get('/api/admin/users?page=1&pageSize=5').expect(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.page).toBe(1);
    expect(list.body.pageSize).toBe(5);
    expect(typeof list.body.total).toBe('number');
  });

  it('fetches user by id and updates fields', async () => {
    const got = await adminAgent.get(`/api/admin/users/${createdUserId}`).expect(200);
    expect(got.body.id).toBe(createdUserId);
    const upd = await adminAgent.put(`/api/admin/users/${createdUserId}`).send({ display_name: 'Beta', is_active: false }).expect(200);
    expect(upd.body.display_name).toBe('Beta');
    expect(upd.body.is_active).toBe(false);
  });

  it('rejects non-boolean is_active on update', async () => {
    await adminAgent.put(`/api/admin/users/${createdUserId}`).send({ is_active: 'nope' }).expect(400);
  });

  it('activates and deactivates user', async () => {
    const deact = await adminAgent.post(`/api/admin/users/${createdUserId}/deactivate`).expect(200);
    expect(deact.body.is_active).toBe(false);
    const act = await adminAgent.post(`/api/admin/users/${createdUserId}/activate`).expect(200);
    expect(act.body.is_active).toBe(true);
  });

  it('soft-deletes user via DELETE', async () => {
    const resp = await adminAgent.delete(`/api/admin/users/${createdUserId}`).expect(200);
    expect(resp.body.is_active).toBe(false);
  });

  it('returns 404 for missing user id and 400 for invalid id', async () => {
    await adminAgent.get('/api/admin/users/999999999').expect(404);
    await adminAgent.get('/api/admin/users/abc').expect(400);
  });

  it('returns 409 on duplicate email', async () => {
    // Create once
    const email = `dup.${Date.now()}@example.com`;
    await adminAgent.post('/api/admin/users').send({ email, password: 'ChangeMe1' }).expect(201);
    // Try duplicate
    await adminAgent.post('/api/admin/users').send({ email: email.toUpperCase(), password: 'ChangeMe1' }).expect(409);
  });
});
