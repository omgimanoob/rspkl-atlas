import { AuthService } from '../../src/services/authService';
import { db } from '../../src/db/client';
import { users } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

describe('AuthService self-service', () => {
  const email = `svc.self.${Date.now()}@example.com`;
  const pwd = 'AlphaPwd123!';
  let userId: number;

  beforeAll(async () => {
    const hash = await bcrypt.hash(pwd, 12);
    await db.insert(users).values({ email, passwordHash: hash, isActive: 1 });
    const u = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0]);
    userId = u.id;
  });

  afterAll(async () => {
    const u = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0]);
    if (u) await db.delete(users).where(eq(users.id, u.id));
  });

  it('changePassword rotates hash with correct current', async () => {
    await expect(AuthService.changePassword(userId, pwd, 'BetaPwd123!')).resolves.toBe(true);
  });

  it('changePassword rejects wrong current and weak new', async () => {
    await expect(AuthService.changePassword(userId, 'WRONG', 'GammaPwd123!')).rejects.toThrow('invalid_current_password');
    await expect(AuthService.changePassword(userId, 'BetaPwd123!', 'short')).rejects.toThrow('weak_password');
  });

  it('request and confirm password reset', async () => {
    const req = await AuthService.requestPasswordReset(email, 'http://localhost:5173');
    expect(req.ok).toBe(true);
    const token = (req as any).debugToken;
    expect(typeof token).toBe('string');
    await expect(AuthService.confirmPasswordReset(token, 'DeltaPwd123!')).resolves.toBe(true);
    await expect(AuthService.confirmPasswordReset(token, 'EchoPwd123!')).rejects.toThrow();
  });
});
