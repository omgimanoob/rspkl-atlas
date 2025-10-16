# Drizzle ORM Setup (MySQL)

This guide documents how we use Drizzle ORM with mysql2 for RBAC and auth data. It includes minimal config, schema skeleton, and migration/seed pointers.

Status
- Installed (done): `npm i drizzle-orm drizzle-kit mysql2`
- Note: `mysql2` ships its own TypeScript types — no `@types/mysql2` package is needed.

## Install & Files

- Dependencies (already done):
  - Runtime: `drizzle-orm drizzle-kit mysql2`
  - Dev: none required for mysql2 types.
- New files to add:
  - `drizzle.config.ts` — Drizzle Kit configuration
  - `src/db/schema.ts` — database schema (Drizzle models)
  - `src/db/client.ts` — Drizzle client wrapping our existing `atlasPool`
  - `scripts/migrate.ts` — migration runner using Drizzle migrator

## drizzle.config.ts (example)

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    host: process.env.ATLAS_DB_HOST || 'localhost',
    user: process.env.ATLAS_DB_USER || 'root',
    password: process.env.ATLAS_DB_PASSWORD || '',
    database: process.env.ATLAS_DB_DATABASE || 'atlas',
    port: Number(process.env.ATLAS_DB_PORT || 3306),
  },
  verbose: true,
  strict: true,
});
```

## src/db/schema.ts (skeleton)

```ts
import {
  mysqlTable, varchar, bigint, int, tinyint, timestamp,
  uniqueIndex, index
} from 'drizzle-orm/mysql-core';

// Users
export const users = mysqlTable('users', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }),
  isActive: tinyint('is_active').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  emailUx: uniqueIndex('ux_users_email').on(t.email),
}));

// Roles & Permissions
export const roles = mysqlTable('roles', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 32 }).notNull(),
}, (t) => ({ nameUx: uniqueIndex('ux_roles_name').on(t.name) }));

export const permissions = mysqlTable('permissions', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 64 }).notNull(),
}, (t) => ({ nameUx: uniqueIndex('ux_permissions_name').on(t.name) }));

// Joins
export const userRoles = mysqlTable('user_roles', {
  userId: bigint('user_id', { mode: 'number', unsigned: true }).notNull(),
  roleId: int('role_id').notNull(),
}, (t) => ({ pk: index('pk_user_roles').on(t.userId, t.roleId) }));

export const rolePermissions = mysqlTable('role_permissions', {
  roleId: int('role_id').notNull(),
  permissionId: int('permission_id').notNull(),
}, (t) => ({ pk: index('pk_role_permissions').on(t.roleId, t.permissionId) }));

export const userPermissions = mysqlTable('user_permissions', {
  userId: bigint('user_id', { mode: 'number', unsigned: true }).notNull(),
  permissionId: int('permission_id').notNull(),
}, (t) => ({ pk: index('pk_user_permissions').on(t.userId, t.permissionId) }));

// Scoped grants (resource-level)
export const permissionGrants = mysqlTable('permission_grants', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  subjectType: varchar('subject_type', { length: 16 }).notNull(), // 'role' | 'user'
  subjectId: bigint('subject_id', { mode: 'number', unsigned: true }).notNull(),
  permission: varchar('permission', { length: 64 }).notNull(),
  resourceType: varchar('resource_type', { length: 32 }),
  resourceId: bigint('resource_id', { mode: 'number', unsigned: true }),
  constraintsJson: varchar('constraints_json', { length: 1024 }),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  subjIdx: index('ix_grants_subject').on(t.subjectType, t.subjectId),
  permIdx: index('ix_grants_permission').on(t.permission),
}));

// (Optional) Dedicated RBAC audit table
export const rbacAuditLogs = mysqlTable('rbac_audit_logs', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }),
  permission: varchar('permission', { length: 64 }).notNull(),
  resourceType: varchar('resource_type', { length: 32 }),
  resourceId: bigint('resource_id', { mode: 'number', unsigned: true }),
  decision: varchar('decision', { length: 16 }).notNull(), // allow | deny
  reason: varchar('reason', { length: 128 }),
  route: varchar('route', { length: 255 }),
  method: varchar('method', { length: 16 }),
  ip: varchar('ip', { length: 64 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

## src/db/client.ts (example)

```ts
import { drizzle } from 'drizzle-orm/mysql2';
import { atlasPool } from '../../db';
import * as schema from './schema';

export const db = drizzle(atlasPool, { schema });
```

## scripts/migrate.ts (example)

```ts
import 'dotenv/config';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { db } from '../src/db/client';

async function main() {
  await migrate(db, { migrationsFolder: 'drizzle' });
  console.log('Migrations applied');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

## NPM scripts (suggested)

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate --config=drizzle.config.ts",
    "db:migrate": "ts-node scripts/migrate.ts",
    "db:seed": "ts-node scripts/seed.ts"
  }
}
```

## Seeding (outline)
- Insert baseline roles: `hr`, `management`, `directors`, `admins`.
- Insert baseline permissions: `project:read`, `timesheet:read`, `bi:read`, `overrides:update`, `sync:execute`, `rbac:admin`.
- Map roles → permissions to mirror current behavior.
- Optionally create an admin user and assign `admins` role (align with existing admin seed).

## Notes
- `@types/mysql2` is not required (and not published) — `mysql2` includes its own types.
- You may see `npm audit` advisories; address as needed (`npm audit fix`), but they are unrelated to Drizzle.

