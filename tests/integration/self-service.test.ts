import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import { users, passwordResetTokens } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

jest.setTimeout(40000);

async function createUserDirect(email: string, password: string) {
  const hash = await bcrypt.hash(password, 12);
  await db.insert(users).values({ email, passwordHash: hash, displayName: 'Self', isActive: 1 }).onDuplicateKeyUpdate({ set: { email } });
  const user = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0]);
  return user;
}

async function deleteUserByEmail(email: string) {
  const u = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0]);
  if (u) {
    await db.delete(users).where(eq(users.id, u.id));
  }
}

describe('User Self-Service', () => {
  const agent = request.agent(app);
  const email = `self.${Date.now()}@example.com`;
  const pwd = 'StartPwd123!';
  let userId: number;

  beforeAll(async () => {
    const u = await createUserDirect(email, pwd);
    userId = u.id;
    await agent.post('/auth/login').send({ email, password: pwd }).expect(200);
  });

  afterAll(async () => {
    await deleteUserByEmail(email);
  });

  it('GET /me returns sanitized identity for authenticated user', async () => {
    const me = await agent.get('/me').expect(200);
    expect(me.body.email).toBe(email);
    expect(me.body.id).toBe(userId);
  });

  it('GET /me without cookie → 401', async () => {
    await request(app).get('/me').expect(401);
  });

  it('PUT /me updates display_name only', async () => {
    const up = await agent.put('/me').send({ display_name: 'New Name', ignored: 'no' }).expect(200);
    expect(up.body.display_name).toBe('New Name');
  });

  it('POST /me/password changes password with current verification', async () => {
    await agent.post('/me/password').send({ current_password: pwd, new_password: 'NextPwd123!' }).expect(200);
    // old password should fail, new should work
    await agent.post('/auth/login').send({ email, password: pwd }).expect(401);
    await agent.post('/auth/login').send({ email, password: 'NextPwd123!' }).expect(200);
  });

  it('rejects wrong current password and weak new password', async () => {
    await agent.post('/me/password').send({ current_password: 'WRONG', new_password: 'NewerPwd123!' }).expect(400);
    await agent.post('/me/password').send({ current_password: 'NextPwd123!', new_password: 'short' }).expect(400);
  });

  it('POST /me/password without cookie → 401', async () => {
    await request(app).post('/me/password').send({ current_password: 'x', new_password: 'NewPass123!' }).expect(401);
  });

  it('password reset request/confirm flow', async () => {
    // request reset
    const reqResp = await agent.post('/auth/password-reset/request').send({ email }).expect(200);
    expect(reqResp.body.ok).toBe(true);
    const token = reqResp.body.debugToken; // only present in test env
    expect(typeof token).toBe('string');
    // confirm with token
    await agent.post('/auth/password-reset/confirm').send({ token, new_password: 'FinalPwd123!' }).expect(200);
    // reusing token fails
    await agent.post('/auth/password-reset/confirm').send({ token, new_password: 'AnotherPwd123!' }).expect(400);
    // login with new password works
    await agent.post('/auth/login').send({ email, password: 'FinalPwd123!' }).expect(200);
  });

  it('rate limit enforced on password reset requests (429)', async () => {
    // selfWriteLimiter is set to max=100 in tests; hammer to exceed
    for (let i = 0; i < 100; i++) {
      await agent.post('/auth/password-reset/request').set('x-rl-key', 'rltest-1').send({ email }).expect(200);
    }
    await agent.post('/auth/password-reset/request').set('x-rl-key', 'rltest-1').send({ email }).expect(429);
  });

  it('expired token returns 400', async () => {
    const reqResp = await agent.post('/auth/password-reset/request').set('x-rl-key', 'rltest-2').send({ email }).expect(200);
    const token = reqResp.body.debugToken as string;
    // Expire the token in DB
    const hash = require('crypto').createHash('sha256').update(token).digest('hex');
    const row = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, hash)).limit(1).then(r => r[0]);
    await db.update(passwordResetTokens).set({ expiresAt: new Date(Date.now() - 60_000) }).where(eq(passwordResetTokens.id, row.id));
    await agent.post('/auth/password-reset/confirm').set('x-rl-key', 'rltest-2').send({ token, new_password: 'ExpiredPwd123!' }).expect(400);
  });


  it('reset request for non-existing email still returns 200', async () => {
    await agent.post('/auth/password-reset/request').set('x-rl-key', 'rltest-3').send({ email: `no-${Date.now()}@example.com` }).expect(200);
  });

  it('confirm with malformed token returns 400', async () => {
    await agent.post('/auth/password-reset/confirm').set('x-rl-key', 'rltest-4').send({ token: 'bogus-token', new_password: 'ZetaPwd123!' }).expect(400);
  });
});
