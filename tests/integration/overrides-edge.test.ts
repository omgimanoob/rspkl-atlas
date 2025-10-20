import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import { users, roles, userRoles } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

async function ensureRole(code: string, displayName?: string) {
  await db.insert(roles).values({ code, name: displayName || code }).onDuplicateKeyUpdate({ set: { name: displayName || code } });
  return db.select({ id: roles.id }).from(roles).where(eq(roles.code, code)).limit(1).then(r => r[0]);
}

async function createUser(email: string, password: string, roleNames: string[] = []) {
  const hash = await bcrypt.hash(password, 12);
  await db.insert(users).values({ email, passwordHash: hash, displayName: 'Edge Test', isActive: 1 }).onDuplicateKeyUpdate({ set: { email } });
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
    await db.delete(users).where(eq(users.id, u.id));
  }
}

describe('Overrides edge cases: missing project id', () => {
  const agent = request.agent(app);
  const pwd = 'Secret123!';
  const hrEmail = `edge.hr.${Date.now()}@example.com`;
  const basicEmail = `edge.basic.${Date.now()}@example.com`;

  beforeAll(async () => {
    await createUser(hrEmail, pwd, ['hr']);
    await createUser(basicEmail, pwd, []);
  });

  afterAll(async () => {
    await deleteUser(hrEmail);
    await deleteUser(basicEmail);
  });

  it('hr user: missing id yields 400 (controller validation)', async () => {
    await agent.post('/auth/login').send({ email: hrEmail, password: pwd }).expect(200);
    await agent.put('/overrides/status').send({ status: 'active' }).expect(400);
    await agent.put('/overrides').send({ status: 'active' }).expect(400);
    await agent.post('/auth/logout').expect(200);
  });

  it('basic user: missing id yields 403 (permission enforce)', async () => {
    await agent.post('/auth/login').send({ email: basicEmail, password: pwd }).expect(200);
    await agent.put('/overrides/status').send({ status: 'active' }).expect(403);
    await agent.put('/overrides').send({ status: 'active' }).expect(403);
    await agent.post('/auth/logout').expect(200);
  });
});
