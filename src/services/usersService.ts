import { db } from '../db/client';
import { users } from '../db/schema';
import { and, eq, like, SQL } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export type CreateUserInput = {
  email: string;
  password: string;
  displayName?: string | null;
  isActive?: boolean;
};

export type UpdateUserInput = {
  displayName?: string | null;
  isActive?: boolean;
  password?: string;
};

export type UserDTO = {
  id: number;
  email: string;
  display_name: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

function toDTO(u: any): UserDTO {
  return {
    id: u.id,
    email: u.email,
    display_name: u.displayName ?? null,
    is_active: !!u.isActive,
    created_at: u.createdAt,
    updated_at: u.updatedAt,
  };
}

export const UsersService = {
  async createUser(input: CreateUserInput): Promise<UserDTO> {
    const email = String(input.email).trim().toLowerCase();
    const hash = await bcrypt.hash(String(input.password), 12);
    const displayName = input.displayName ?? null;
    const isActive = input.isActive === undefined ? 1 : input.isActive ? 1 : 0;
    await db.insert(users).values({ email, passwordHash: hash, displayName, isActive });
    const row = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
      .then((r) => r[0]);
    return toDTO(row);
  },

  async getUserById(id: number): Promise<UserDTO | null> {
    const row = await db.select().from(users).where(eq(users.id, id)).limit(1).then((r) => r[0]);
    if (!row) return null;
    return toDTO(row);
  },

  async listUsers(opts: { page?: number; pageSize?: number; search?: string; active?: boolean }): Promise<{ data: UserDTO[]; total: number; page: number; pageSize: number }>
  {
    const page = Math.max(1, Number(opts.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(opts.pageSize || 20)));
    const offset = (page - 1) * pageSize;
    const whereClauses: SQL[] = [] as any;
    if (typeof opts.active === 'boolean') {
      whereClauses.push(eq(users.isActive, opts.active ? 1 : 0));
    }
    if (opts.search && opts.search.trim()) {
      const q = `%${opts.search.trim().toLowerCase()}%`;
      whereClauses.push(like(users.email, q));
    }
    const where = whereClauses.length > 0 ? (whereClauses.length === 1 ? whereClauses[0] : (and as any)(...whereClauses)) : undefined;
    const rows = await db.select().from(users).where(where as any).limit(pageSize).offset(offset);
    const totalRows = await db.select({ id: users.id }).from(users).where(where as any);
    return {
      data: rows.map(toDTO),
      total: totalRows.length,
      page,
      pageSize,
    };
  },

  async updateUser(id: number, input: UpdateUserInput): Promise<UserDTO | null> {
    const sets: any = {};
    if (input.displayName !== undefined) sets.displayName = input.displayName;
    if (typeof input.isActive === 'boolean') sets.isActive = input.isActive ? 1 : 0;
    if (input.password) {
      sets.passwordHash = await bcrypt.hash(String(input.password), 12);
    }
    if (Object.keys(sets).length === 0) {
      const existing = await db.select().from(users).where(eq(users.id, id)).limit(1).then((r) => r[0]);
      return existing ? toDTO(existing) : null;
    }
    await db.update(users).set(sets).where(eq(users.id, id));
    const row = await db.select().from(users).where(eq(users.id, id)).limit(1).then((r) => r[0]);
    return row ? toDTO(row) : null;
  },

  async setActive(id: number, isActive: boolean): Promise<UserDTO | null> {
    await db.update(users).set({ isActive: isActive ? 1 : 0 }).where(eq(users.id, id));
    const row = await db.select().from(users).where(eq(users.id, id)).limit(1).then((r) => r[0]);
    return row ? toDTO(row) : null;
  },
};

