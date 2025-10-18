import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import { users, roles, userRoles } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

async function ensureRole(name: string) {
  await db.insert(roles).values({ name }).onDuplicateKeyUpdate({ set: { name } });
  return db.select({ id: roles.id }).from(roles).where(eq(roles.name, name)).limit(1).then(r => r[0]);
}

async function createUser(email: string, password: string, roleNames: string[] = []) {
  const hash = await bcrypt.hash(password, 12);
  await db.insert(users).values({ email, passwordHash: hash, displayName: 'Status Test', isActive: 1 }).onDuplicateKeyUpdate({ set: { email } });
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

jest.mock('../../src/services/statusService', () => ({
  StatusService: {
    getById: jest
      .fn()
      .mockImplementation((id: number) =>
        id === 1234 ? Promise.resolve({ id: 1234, name: 'Under construction', is_active: 1 }) : Promise.resolve(null)
      ),
    ensureSchema: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Overrides status validation', () => {
  const agent = request.agent(app);
  const pwd = 'Secret123!';
  const hrEmail = `status.hr.${Date.now()}@example.com`;

  beforeAll(async () => {
    await createUser(hrEmail, pwd, ['hr']);
    await agent.post('/auth/login').send({ email: hrEmail, password: pwd }).expect(200);
  });

  afterAll(async () => {
    await agent.post('/auth/logout').expect(200);
    await deleteUser(hrEmail);
  });

  it('rejects missing status_id on /overrides/status', async () => {
    await agent.put('/overrides/status').send({ id: 123, status: 'Under construction' }).expect(400);
  });

  it('accepts valid status_id on /overrides/status', async () => {
    await agent.put('/overrides/status').send({ id: 123, status_id: 1234 }).expect(200);
  });

  it('rejects missing status_id on /overrides upsert when status provided', async () => {
    await agent.put('/overrides').send({ id: 123, status: 'Under construction' }).expect(400);
  });

  it('accepts valid status_id on /overrides upsert', async () => {
    await agent.put('/overrides').send({ id: 123, status_id: 1234, money_collected: 1000 }).expect(200);
  });
});
