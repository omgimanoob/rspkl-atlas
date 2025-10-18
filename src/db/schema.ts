import {
  mysqlTable,
  varchar,
  bigint,
  int,
  tinyint,
  timestamp,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/mysql-core';

// Users (introduce as first-class model)
export const users = mysqlTable(
  'users',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }),
    isActive: tinyint('is_active').notNull().default(1),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => ({
    emailUx: uniqueIndex('ux_users_email').on(t.email),
  })
);

// Roles & Permissions
export const roles = mysqlTable(
  'roles',
  {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 32 }).notNull(),
  },
  (t) => ({ nameUx: uniqueIndex('ux_roles_name').on(t.name) })
);

export const permissions = mysqlTable(
  'permissions',
  {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 64 }).notNull(),
  },
  (t) => ({ nameUx: uniqueIndex('ux_permissions_name').on(t.name) })
);

// Joins
export const userRoles = mysqlTable(
  'user_roles',
  {
    userId: bigint('user_id', { mode: 'number', unsigned: true }).notNull(),
    roleId: int('role_id').notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.roleId], name: 'pk_user_roles' }) })
);

export const rolePermissions = mysqlTable(
  'role_permissions',
  {
    roleId: int('role_id').notNull(),
    permissionId: int('permission_id').notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.roleId, t.permissionId], name: 'pk_role_permissions' }) })
);

export const userPermissions = mysqlTable(
  'user_permissions',
  {
    userId: bigint('user_id', { mode: 'number', unsigned: true }).notNull(),
    permissionId: int('permission_id').notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.permissionId], name: 'pk_user_permissions' }) })
);

// Scoped grants (resource-level)
export const permissionGrants = mysqlTable(
  'permission_grants',
  {
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
  },
  (t) => ({
    subjIdx: index('ix_grants_subject').on(t.subjectType, t.subjectId),
    permIdx: index('ix_grants_permission').on(t.permission),
  })
);

// Optional dedicated RBAC audit table (or extend existing audit_logs)
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

// General audit logs (existing usage in recordAudit)
export const auditLogs = mysqlTable('audit_logs', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }),
  email: varchar('email', { length: 255 }),
  route: varchar('route', { length: 255 }).notNull(),
  method: varchar('method', { length: 16 }).notNull(),
  statusCode: int('status_code'),
  payloadHash: varchar('payload_hash', { length: 128 }),
  ip: varchar('ip', { length: 64 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Password reset tokens
export const passwordResetTokens = mysqlTable('password_reset_tokens', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }).notNull(),
  tokenHash: varchar('token_hash', { length: 128 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
