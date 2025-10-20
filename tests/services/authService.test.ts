import { AuthService } from '../../src/services/authService';
import { db } from '../../src/db/client';
import { users, roles, userRoles } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

describe('AuthService (Drizzle)', () => {
  const email = `ut.auth.${Date.now()}@example.com`;
  const password = 'P@ssw0rd!';
  const displayName = 'Unit Test User';

  afterAll(async () => {
    const row = await db.select().from(users).where(eq(users.email, email)).limit(1).then(r => r[0]);
    if (row) {
      await db.delete(userRoles).where(eq(userRoles.userId, row.id));
      await db.delete(users).where(eq(users.id, row.id));
    }
    // Clean up test role if exists (by code)
    const rcode = 'qa_role_unit';
    const r = await db.select().from(roles).where(eq(roles.code, rcode)).limit(1).then(x => x[0]);
    if (r) {
      await db.delete(userRoles).where(eq(userRoles.roleId, r.id));
      // Do not delete the role itself to avoid affecting other tests that may reuse names
    }
  });

  it('createUser and findUserByEmail return expected fields', async () => {
    const id = await AuthService.createUser(email, password, displayName);
    expect(typeof id).toBe('number');
    const found = await AuthService.findUserByEmail(email);
    expect(found?.email).toBe(email);
    expect(found?.display_name).toBe(displayName);
    expect(found?.is_active).toBe(1);
    expect(found?.password_hash).toBeDefined();
  });

  it('ensureRole is idempotent and assignRole/getUserRoles work', async () => {
    const rname = 'qa_role_unit';
    const id1 = await AuthService.ensureRole(rname);
    const id2 = await AuthService.ensureRole(rname);
    expect(id1).toBe(id2);

    const user = await AuthService.findUserByEmail(email);
    expect(user).toBeTruthy();
    await AuthService.assignRole(user!.id, rname);
    // idempotent
    await AuthService.assignRole(user!.id, rname);
    const rolesList = await AuthService.getUserRoles(user!.id);
    expect(rolesList.includes(rname)).toBe(true);
  });
});
