import { UsersService } from '../../src/services/usersService';
import { db } from '../../src/db/client';
import { users } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

describe('UsersService', () => {
  const emailBase = `unit.user.${Date.now()}@example.com`;

  afterAll(async () => {
    // Cleanup created users by prefix
    const rows = await db.select().from(users);
    const toDelete = rows.filter((u: any) => String(u.email).includes(emailBase.split('@')[0]));
    for (const r of toDelete) {
      await db.delete(users).where(eq(users.id, r.id));
    }
  });

  it('creates a user and fetches by id', async () => {
    const email = `a+${emailBase}`;
    const user = await UsersService.createUser({ email, password: 'Secret123!', displayName: 'Alpha' });
    expect(user.email).toBe(email.toLowerCase());
    expect(user.display_name).toBe('Alpha');
    const got = await UsersService.getUserById(user.id);
    expect(got?.id).toBe(user.id);
  });

  it('enforces unique email (case-insensitive)', async () => {
    const email = `b+${emailBase}`;
    await UsersService.createUser({ email, password: 'Secret123!' });
    await expect(UsersService.createUser({ email: email.toUpperCase(), password: 'Secret123!' })).rejects.toBeTruthy();
  });

  it('updates fields and password, does not expose hash', async () => {
    const email = `c+${emailBase}`;
    const user = await UsersService.createUser({ email, password: 'Secret123!' });
    const updated = await UsersService.updateUser(user.id, { displayName: 'Beta', isActive: false, password: 'NewSecret123!' });
    expect(updated?.display_name).toBe('Beta');
    expect(updated?.is_active).toBe(false);
    // Ensure DTO shape; no password fields
    expect((updated as any).password_hash).toBeUndefined();
  });

  it('setActive toggles state', async () => {
    const email = `d+${emailBase}`;
    const user = await UsersService.createUser({ email, password: 'Secret123!' });
    const deact = await UsersService.setActive(user.id, false);
    expect(deact?.is_active).toBe(false);
    const act = await UsersService.setActive(user.id, true);
    expect(act?.is_active).toBe(true);
  });
});

