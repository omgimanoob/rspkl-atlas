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
import { text } from 'drizzle-orm/mysql-core';

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
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
  },
  (t) => ({
    codeUx: uniqueIndex('ux_roles_code').on(t.code),
    nameUx: uniqueIndex('ux_roles_name').on(t.name),
  })
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

// ---------------------------------------------------------------------------
// Kimai replicas (for analytics / BI)
// ---------------------------------------------------------------------------

export const replicaKimaiProjects = mysqlTable(
  'replica_kimai_projects',
  {
    id: int('id').primaryKey(),
    customerId: int('customer_id'),
    name: varchar('name', { length: 150 }),
    comment: text('comment'),
    visible: tinyint('visible'),
    budget: varchar('budget', { length: 64 }), // keep as string to avoid FP issues; optional typing later
    color: varchar('color', { length: 7 }),
    timeBudget: int('time_budget'),
    orderDate: timestamp('order_date'),
    start: timestamp('start'),
    end: timestamp('end'),
    timezone: varchar('timezone', { length: 64 }),
    budgetType: varchar('budget_type', { length: 10 }),
    billable: tinyint('billable'),
    syncedAt: timestamp('synced_at').notNull().defaultNow(),
  },
  (t) => ({ ixCustomer: index('ix_replica_proj_customer').on(t.customerId) })
);

export const replicaKimaiTimesheets = mysqlTable(
  'replica_kimai_timesheets',
  {
    id: int('id').primaryKey(),
    user: int('user'),
    activityId: int('activity_id'),
    projectId: int('project_id'),
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time'),
    duration: int('duration'),
    description: varchar('description', { length: 191 }),
    rate: varchar('rate', { length: 64 }),
    fixedRate: varchar('fixed_rate', { length: 64 }),
    hourlyRate: varchar('hourly_rate', { length: 64 }),
    exported: tinyint('exported'),
    timezone: varchar('timezone', { length: 64 }),
    internalRate: varchar('internal_rate', { length: 64 }),
    billable: tinyint('billable'),
    category: varchar('category', { length: 10 }),
    modifiedAt: timestamp('modified_at'),
    dateTz: varchar('date_tz', { length: 16 }),
    syncedAt: timestamp('synced_at').notNull().defaultNow(),
  },
  (t) => ({
    ixProj: index('ix_replica_ts_project').on(t.projectId),
    ixUser: index('ix_replica_ts_user').on(t.user),
    ixActivity: index('ix_replica_ts_activity').on(t.activityId),
    ixDate: index('ix_replica_ts_date').on(t.dateTz),
    ixModified: index('ix_replica_ts_modified').on(t.modifiedAt),
  })
);

export const syncState = mysqlTable('sync_state', {
  key: varchar('state_key', { length: 64 }).primaryKey(),
  value: varchar('state_value', { length: 191 }),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export const replicaKimaiUsers = mysqlTable(
  'replica_kimai_users',
  {
    id: int('id').primaryKey(),
    username: varchar('username', { length: 191 }),
    email: varchar('email', { length: 191 }),
    enabled: tinyint('enabled'),
    color: varchar('color', { length: 7 }),
    account: varchar('account', { length: 30 }),
    systemAccount: tinyint('system_account'),
    supervisorId: int('supervisor_id'),
    timezone: varchar('timezone', { length: 64 }),
    syncedAt: timestamp('synced_at').notNull().defaultNow(),
  },
  (t) => ({ ixEnabled: index('ix_replica_users_enabled').on(t.enabled) })
);

export const replicaKimaiActivities = mysqlTable(
  'replica_kimai_activities',
  {
    id: int('id').primaryKey(),
    projectId: int('project_id'),
    name: varchar('name', { length: 150 }),
    visible: tinyint('visible'),
    billable: tinyint('billable'),
    timeBudget: int('time_budget'),
    budget: varchar('budget', { length: 64 }),
    syncedAt: timestamp('synced_at').notNull().defaultNow(),
  },
  (t) => ({ ixProj: index('ix_replica_act_project').on(t.projectId) })
);

export const replicaKimaiTags = mysqlTable(
  'replica_kimai_tags',
  {
    id: int('id').primaryKey(),
    name: varchar('name', { length: 191 }),
    color: varchar('color', { length: 7 }),
    syncedAt: timestamp('synced_at').notNull().defaultNow(),
  }
);

export const replicaKimaiTimesheetTags = mysqlTable(
  'replica_kimai_timesheet_tags',
  {
    timesheetId: int('timesheet_id').notNull(),
    tagId: int('tag_id').notNull(),
    syncedAt: timestamp('synced_at').notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.timesheetId, t.tagId], name: 'pk_replica_ts_tags' }) })
);

export const replicaKimaiTimesheetMeta = mysqlTable(
  'replica_kimai_timesheet_meta',
  {
    id: int('id').primaryKey(),
    timesheetId: int('timesheet_id').notNull(),
    name: varchar('name', { length: 50 }).notNull(),
    value: text('value'),
    visible: tinyint('visible').notNull().default(0),
    syncedAt: timestamp('synced_at').notNull().defaultNow(),
  },
  (t) => ({
    ixTimesheet: index('ix_rktm_timesheet').on(t.timesheetId),
    ixName: index('ix_rktm_name').on(t.name),
  })
);

export const replicaKimaiCustomers = mysqlTable(
  'replica_kimai_customers',
  {
    id: int('id').primaryKey(),
    name: varchar('name', { length: 191 }),
    visible: tinyint('visible'),
    timezone: varchar('timezone', { length: 64 }),
    currency: varchar('currency', { length: 8 }),
    syncedAt: timestamp('synced_at').notNull().defaultNow(),
  }
);

// Overrides projects (overlay over Kimai projects)
export const overridesProjects = mysqlTable(
  'overrides_projects',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
    kimaiProjectId: bigint('kimai_project_id', { mode: 'number', unsigned: true }),
    moneyCollected: varchar('money_collected', { length: 64 }),
    statusId: int('status_id'),
    isProspective: tinyint('is_prospective'),
    notes: varchar('notes', { length: 1024 }),
    source: varchar('source', { length: 64 }),
    updatedByUserId: bigint('updated_by_user_id', { mode: 'number', unsigned: true }),
    updatedByEmail: varchar('updated_by_email', { length: 255 }),
    extrasJson: varchar('extras_json', { length: 2048 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => ({
    uxProject: uniqueIndex('ux_overrides_projects_kimai_project').on(t.kimaiProjectId),
    ixProspective: index('ix_overrides_projects_prospective').on(t.isProspective),
  })
);

// Password reset tokens
export const passwordResetTokens = mysqlTable('password_reset_tokens', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }).notNull(),
  tokenHash: varchar('token_hash', { length: 128 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
