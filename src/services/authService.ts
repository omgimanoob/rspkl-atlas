import { atlasPool } from '../../db';
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
  async ensureAuthSchema() {
    // Apply idempotent schema (safe if run multiple times)
    const schemaSql = `
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(255) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      );
      CREATE TABLE IF NOT EXISTS roles (
        id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(32) NOT NULL UNIQUE,
        PRIMARY KEY (id)
      );
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id BIGINT UNSIGNED NOT NULL,
        role_id SMALLINT UNSIGNED NOT NULL,
        PRIMARY KEY (user_id, role_id)
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NULL,
        email VARCHAR(255) NULL,
        route VARCHAR(255) NOT NULL,
        method VARCHAR(16) NOT NULL,
        status_code INT NULL,
        payload_hash VARCHAR(128) NULL,
        ip VARCHAR(64) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      );
      INSERT IGNORE INTO roles (name) VALUES ('hr'), ('management'), ('directors'), ('admins');
    `;
    // Run as a single multi-statement query if supported.
    // Otherwise split by ';' and run sequentially.
    const statements = schemaSql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await atlasPool.query(stmt);
    }
  },

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const [rows] = await atlasPool.query<any[]>(
      'SELECT * FROM users WHERE email = ? AND is_active = 1 LIMIT 1',
      [email]
    );
    return rows[0] || null;
  },

  async getUserRoles(userId: number): Promise<string[]> {
    const [rows] = await atlasPool.query<any[]>(
      `SELECT r.name FROM roles r 
       JOIN user_roles ur ON ur.role_id = r.id 
       WHERE ur.user_id = ?`,
      [userId]
    );
    return rows.map(r => r.name);
  },

  async createUser(email: string, password: string, displayName?: string): Promise<number> {
    const hash = await bcrypt.hash(password, 12);
    const [result]: any = await atlasPool.query(
      'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)',
      [email, hash, displayName || null]
    );
    return result.insertId as number;
  },

  async ensureRole(name: string): Promise<number> {
    await atlasPool.query('INSERT IGNORE INTO roles (name) VALUES (?)', [name]);
    const [rows] = await atlasPool.query<any[]>(
      'SELECT id FROM roles WHERE name = ? LIMIT 1',
      [name]
    );
    return rows[0]?.id;
  },

  async assignRole(userId: number, roleName: string) {
    const roleId = await this.ensureRole(roleName);
    await atlasPool.query(
      'INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)',
      [userId, roleId]
    );
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

