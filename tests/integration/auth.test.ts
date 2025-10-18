import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import { users, roles, userRoles } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

const TEST_EMAIL = 'itest.user@example.com';
const TEST_PASSWORD = 'Secret123!';

async function seedUserWithRole(email: string, password: string, roleName: string) {
  const hash = await bcrypt.hash(password, 12);
  // Ensure role exists
  await db.insert(roles).values({ name: roleName }).onDuplicateKeyUpdate({ set: { name: roleName } });
  const role = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, roleName)).limit(1).then(r => r[0]);
  // Ensure user exists
  await db.insert(users).values({ email, passwordHash: hash, displayName: 'ITest User', isActive: 1 }).onDuplicateKeyUpdate({ set: { email } });
  const user = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0]);
  // Map role
  await db.insert(userRoles).values({ userId: user.id, roleId: role.id }).onDuplicateKeyUpdate({ set: { userId: user.id, roleId: role.id } });
}

async function cleanupUser(email: string) {
  const u = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0]);
  if (u) {
    await db.delete(userRoles).where(eq(userRoles.userId, u.id));
    await db.delete(users).where(eq(users.id, u.id));
  }
}

describe('Auth integration', () => {
  const agent = request.agent(app);

  beforeAll(async () => {
    await seedUserWithRole(TEST_EMAIL, TEST_PASSWORD, 'hr');
  });

  afterAll(async () => {
    await cleanupUser(TEST_EMAIL);
  });

  it('login with valid credentials sets cookie and returns roles', async () => {
    const res = await agent
      .post('/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(200);
    expect(res.body.email).toBe(TEST_EMAIL);
    expect(Array.isArray(res.body.roles)).toBe(true);
  });

  it('me returns 200 with cookie after login', async () => {
    const res = await agent.get('/me').expect(200);
    expect(res.body.email).toBe(TEST_EMAIL);
  });

  it('logout clears cookie, subsequent /me is 401', async () => {
    await agent.post('/auth/logout').expect(200);
    await agent.get('/me').expect(401);
  });

  it('invalid login returns 401', async () => {
    const bad = request.agent(app);
    await bad.post('/auth/login').send({ email: TEST_EMAIL, password: 'wrong' }).expect(401);
  });
});
