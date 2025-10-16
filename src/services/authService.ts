import { db } from '../db/client';
import { users, roles, userRoles } from '../db/schema';
import { and, eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config';

export type UserRecord = {
  id: number;
  email: string;
  password_hash: string;
  display_name?: string | null;
  is_active: number;
};

export type AuthUser = {
  id: number;
  email: string;
  roles: string[];
};

export const AuthService = {

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const row = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.isActive, 1)))
      .limit(1)
      .then(r => r[0]);
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      password_hash: row.passwordHash,
      display_name: row.displayName ?? null,
      is_active: row.isActive,
    } as UserRecord;
  },

  async getUserRoles(userId: number): Promise<string[]> {
    const rows = await db
      .select({ name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));
    return rows.map(r => r.name);
  },

  async createUser(email: string, password: string, displayName?: string): Promise<number> {
    const hash = await bcrypt.hash(password, 12);
    await db.insert(users).values({ email, passwordHash: hash, displayName: displayName || null });
    const row = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0]);
    return row?.id as number;
  },

  async ensureRole(name: string): Promise<number> {
    await db.insert(roles).values({ name }).onDuplicateKeyUpdate({ set: { name } });
    const row = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, name)).limit(1).then(r => r[0]);
    return row?.id as number;
  },

  async assignRole(userId: number, roleName: string) {
    const roleId = await this.ensureRole(roleName);
    await db
      .insert(userRoles)
      .values({ userId, roleId })
      .onDuplicateKeyUpdate({ set: { userId, roleId } });
  },

  async seedAdminIfConfigured() {
    const { email, password, displayName } = config.adminSeed;
    if (!email || !password) {
      console.warn('[auth] ADMIN_EMAIL/ADMIN_PASSWORD not set; admin user not seeded.');
      return;
    }
    const existing = await this.findUserByEmail(email);
    if (existing) {
      return; // already present
    }
    const userId = await this.createUser(email, password, displayName);
    await this.assignRole(userId, 'admins');
    console.log(`[auth] Seeded admin user: ${email}`);
  },

  signJwt(user: AuthUser): string {
    const payload = { sub: String(user.id), email: user.email, roles: user.roles };
    return jwt.sign(payload, config.auth.jwtSecret, { expiresIn: config.auth.tokenTtlSeconds });
  },

  verifyJwt(token: string): AuthUser | null {
    try {
      const decoded: any = jwt.verify(token, config.auth.jwtSecret);
      return {
        id: Number(decoded.sub),
        email: decoded.email,
        roles: Array.isArray(decoded.roles) ? decoded.roles : [],
      };
    } catch {
      return null;
    }
  },

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },
};
