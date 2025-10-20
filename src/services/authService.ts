import { db } from '../db/client';
import { users, roles, userRoles, passwordResetTokens } from '../db/schema';
import { and, eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import crypto from 'crypto';
import { atlasPool } from '../../db';
import { createMailerFromEnv } from './mailer';
import { validatePasswordStrength } from './passwordPolicy';

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
  async ensurePasswordResetSchema() {
    // Create table if missing to support tests without running migrations
    await atlasPool.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      token_hash VARCHAR(128) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  },

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

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<boolean> {
    const row = await db.select().from(users).where(and(eq(users.id, userId), eq(users.isActive, 1))).limit(1).then(r => r[0]);
    if (!row) return false;
    const ok = await bcrypt.compare(currentPassword, row.passwordHash);
    if (!ok) throw new Error('invalid_current_password');
    if (!newPassword || validatePasswordStrength(newPassword).ok === false) throw new Error('weak_password');
    const hash = await bcrypt.hash(newPassword, 12);
    await db.update(users).set({ passwordHash: hash }).where(eq(users.id, userId));
    return true;
  },

  async requestPasswordReset(email: string): Promise<{ ok: true; debugToken?: string }> {
    await this.ensurePasswordResetSchema();
    const user = await this.findUserByEmail(email);
    if (!user) {
      return { ok: true };
    }
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash, expiresAt });
    const resp: any = { ok: true };
    if (process.env.NODE_ENV === 'test') {
      resp.debugToken = token;
    }
    // Dev logging only: avoid noisy output during tests
    if (process.env.NODE_ENV === 'development') {
      const base = String(config.web.baseUrl || '').replace(/\/$/, '');
      const path = String(config.web.resetPath || '/reset');
      const link = `${base}${path.startsWith('/') ? path : '/' + path}?token=${token}`;
      console.log(`[auth] Password reset link for ${email}: ${link}`);
    }
    // Avoid SMTP sends in test to keep tests fast and deterministic
    if (process.env.NODE_ENV === 'test') {
      return resp;
    }
    try {
      const mailer = createMailerFromEnv();
      const from = process.env.MAILER_FROM_NAME && process.env.MAILER_FROM
        ? `${process.env.MAILER_FROM_NAME} <${process.env.MAILER_FROM}>`
        : process.env.MAILER_FROM || 'no-reply@localhost';
      const base = String(config.web.baseUrl || '').replace(/\/$/, '');
      const path = String(config.web.resetPath || '/reset');
      const link = `${base}${path.startsWith('/') ? path : '/' + path}?token=${token}`;
      await mailer.send({ to: email, from, subject: 'Reset your RSPKL Atlas password', text: `Use this link to reset your password: ${link}` });
    } catch {}
    return resp;
  },

  async confirmPasswordReset(token: string, newPassword: string): Promise<boolean> {
    await this.ensurePasswordResetSchema();
    if (!token || !newPassword) throw new Error('invalid_input');
    if (validatePasswordStrength(newPassword).ok === false) throw new Error('weak_password');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const rows = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash)).limit(1).then(r => r[0]);
    if (!rows) throw new Error('invalid_token');
    const prt: any = rows;
    if (prt.usedAt) throw new Error('token_used');
    if (prt.expiresAt && new Date(prt.expiresAt).getTime() < Date.now()) throw new Error('token_expired');
    // Rotate password
    const userRow = await db.select().from(users).where(eq(users.id, prt.userId)).limit(1).then(r => r[0]);
    if (!userRow || userRow.isActive !== 1) throw new Error('invalid_user');
    const hash = await bcrypt.hash(newPassword, 12);
    await db.update(users).set({ passwordHash: hash }).where(eq(users.id, prt.userId));
    // Mark token used
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, prt.id));
    return true;
  },
};
