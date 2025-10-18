import request from 'supertest';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import { atlasPool } from '../../db';
import { users, roles, userRoles, permissions, rolePermissions } from '../../src/db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

async function ensureRole(name: string) {
  await db.insert(roles).values({ name }).onDuplicateKeyUpdate({ set: { name } });
  return db.select({ id: roles.id, name: roles.name }).from(roles).where(eq(roles.name, name)).limit(1).then(r => r[0]);
}
async function ensurePermission(name: string) {
  await db.insert(permissions).values({ name }).onDuplicateKeyUpdate({ set: { name } });
  return db.select({ id: permissions.id, name: permissions.name }).from(permissions).where(eq(permissions.name, name)).limit(1).then(r => r[0]);
}
async function mapRolePermission(roleId: number, permissionId: number) {
  await db.insert(rolePermissions).values({ roleId, permissionId }).onDuplicateKeyUpdate({ set: { roleId, permissionId } });
}

describe('Prospective projects admin API', () => {
  const agent = request.agent(app);
  const adminEmail = `pros.admin.${Date.now()}@example.com`;
  const pwd = 'Secret123!';
  let createdId: number;

  beforeAll(async () => {
    const hash = await bcrypt.hash(pwd, 12);
    await db.insert(users).values({ email: adminEmail, passwordHash: hash, displayName: 'Pros Admin', isActive: 1 }).onDuplicateKeyUpdate({ set: { email: adminEmail } });
    const adminUser = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail)).limit(1).then(r => r[0]);
    const admins = await ensureRole('admins');
    const star = await ensurePermission('*');
    await mapRolePermission(admins.id, star.id);
    await db.insert(userRoles).values({ userId: adminUser.id, roleId: admins.id }).onDuplicateKeyUpdate({ set: { userId: adminUser.id, roleId: admins.id } });
    await agent.post('/auth/login').send({ email: adminEmail, password: pwd }).expect(200);
  });

  afterAll(async () => {
    // Best effort cleanup happens via schema; no extra deletes required.
  });

  it('creates and lists a prospective project', async () => {
    const create = await agent.post('/admin/prospective').send({ name: 'Prospect A', status: 'Unassigned', notes: 'tbd' }).expect(201);
    createdId = create.body.id;
    expect(create.body.is_prospective).toBe(true);
    const list = await agent.get('/admin/prospective').expect(200);
    expect(list.body.some((r: any) => r.id === createdId && r.name === 'Prospect A')).toBe(true);
  });

  it('links a prospective project to a Kimai project id', async () => {
    const kimaiId = 90000000 + Math.floor(Math.random() * 999999); // reduce collision risk across runs
    // Ensure there is not an existing override for that id (tests run against a persistent DB)
    await atlasPool.query('DELETE FROM overrides_projects WHERE kimai_project_id = ?', [kimaiId]);
    const link = await agent.post(`/admin/prospective/${createdId}/link`).send({ kimai_project_id: kimaiId }).expect(200);
    expect(link.body.kimai_project_id).toBe(kimaiId);
    expect(link.body.is_prospective).toBe(false);
    // Double-link to same kimai id should conflict if another row exists; but here linking again on same row should fail due to already_linked
    await agent.post(`/admin/prospective/${createdId}/link`).send({ kimai_project_id: kimaiId }).expect(400);
  });
});
