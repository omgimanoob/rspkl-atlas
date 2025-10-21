import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import { users, roles, userRoles } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { atlasPool } from '../../db';

async function ensureRole(code: string, displayName?: string) {
  await db.insert(roles).values({ code, name: displayName || code }).onDuplicateKeyUpdate({ set: { name: displayName || code } });
  return db.select({ id: roles.id }).from(roles).where(eq(roles.code, code)).limit(1).then(r => r[0]);
}

async function createAdmin(email: string, password: string) {
  const hash = await bcrypt.hash(password, 12);
  await db.insert(users).values({ email, passwordHash: hash, displayName: 'Statuses Admin', isActive: 1 }).onDuplicateKeyUpdate({ set: { email } });
  const user = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0]);
  const adminRole = await ensureRole('admins');
  await db.insert(userRoles).values({ userId: user.id, roleId: adminRole.id }).onDuplicateKeyUpdate({ set: { userId: user.id, roleId: adminRole.id } });
  return user;
}

async function deleteUser(email: string) {
  const u = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0]);
  if (u) {
    await db.delete(userRoles).where(eq(userRoles.userId, u.id));
    await db.delete(users).where(eq(users.id, u.id));
  }
}

describe('Admin Project Statuses CRUD and usage', () => {
  const agent = request.agent(app);
  const adminEmail = `status.admin.${Date.now()}@example.com`;
  const pwd = 'Secret123!';

  beforeAll(async () => {
    await createAdmin(adminEmail, pwd);
    await agent.post('/auth/login').send({ email: adminEmail, password: pwd }).expect(200);
  });

  afterAll(async () => {
    await agent.post('/auth/logout').expect(200);
    await deleteUser(adminEmail);
  });

  it('creates, lists, updates, and deletes a status', async () => {
    const create = await agent.post('/admin/statuses').send({ name: 'Planning', code: 'planning', sort_order: 10 }).expect(201);
    expect(create.body.id).toBeDefined();
    const id = create.body.id;

    const list = await agent.get('/admin/statuses').expect(200);
    expect(list.body.some((s: any) => s.id === id && s.name === 'Planning')).toBe(true);

    const update = await agent.put(`/admin/statuses/${id}`).send({ name: 'Planning Updated', is_active: false }).expect(200);
    expect(update.body.name).toBe('Planning Updated');
    expect(update.body.is_active === 0 || update.body.is_active === false).toBeTruthy();

    await agent.delete(`/admin/statuses/${id}`).expect(200);
    const list2 = await agent.get('/admin/statuses').expect(200);
    expect(list2.body.some((s: any) => s.id === id)).toBe(false);
  });

  it('uses status_id in overrides upsert', async () => {
    // Ensure status exists (use unique name/code to avoid collisions in persistent DB)
    const suffix = `${Date.now()}`;
    const name = `Alpha-${suffix}`;
    const code = `alpha-${suffix}`;
    const s = await agent.post('/admin/statuses').send({ name, code }).expect(201);
    const sid = s.body.id;
    const pid = 7777000 + Math.floor(Math.random() * 100000);
    try { await atlasPool.query('DELETE FROM overrides_projects WHERE kimai_project_id = ?', [pid]); } catch {}
    const up = await agent.put('/overrides').send({ id: pid, status_id: sid, money_collected: 42 }).expect(200);
    // Verify row exists and has status_id set to sid
    const [row]: any = await atlasPool.query('SELECT status_id FROM overrides_projects WHERE kimai_project_id = ? LIMIT 1', [pid]);
    expect(row.length).toBe(1);
    expect(Number(row[0].status_id)).toBe(Number(sid));
    // Cleanup: remove created override row and status
    try { await atlasPool.query('DELETE FROM overrides_projects WHERE kimai_project_id = ?', [pid]); } catch {}
    try { await agent.delete(`/admin/statuses/${sid}`).expect(200); } catch {}
  });
});
