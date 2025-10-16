import { db } from '../db/client';
import { roles, permissions, rolePermissions, userPermissions, permissionGrants } from '../db/schema';
import { inArray, eq, or, and, isNull, gt } from 'drizzle-orm';
import type { AuthUser } from './authService';

export type ResourceContext = {
  resource_type?: string | null;
  resource_id?: number | null;
};

export type PermissionDecision = {
  allow: boolean;
  reason?: 'unauthenticated' | 'no_grant' | 'scope_mismatch' | 'expired';
};

export const PermissionsService = {
  async getRoleIdsByName(names: string[]): Promise<number[]> {
    if (!names.length) return [];
    const rows = await db.select({ id: roles.id, name: roles.name }).from(roles).where(inArray(roles.name, names));
    return rows.map(r => r.id);
  },

  async getPermissionsForRoles(roleIds: number[]): Promise<string[]> {
    if (!roleIds.length) return [];
    const rows = await db
      .select({ name: permissions.name })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(inArray(rolePermissions.roleId, roleIds));
    return Array.from(new Set(rows.map(r => r.name)));
  },

  async getDirectUserPermissions(userId: number): Promise<string[]> {
    const rows = await db
      .select({ name: permissions.name })
      .from(userPermissions)
      .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
      .where(eq(userPermissions.userId, userId));
    return rows.map(r => r.name);
  },

  async getScopedGrants(userId: number, roleIds: number[]) {
    const now = new Date();
    const rows = await db
      .select({
        subjectType: permissionGrants.subjectType,
        subjectId: permissionGrants.subjectId,
        permission: permissionGrants.permission,
        resourceType: permissionGrants.resourceType,
        resourceId: permissionGrants.resourceId,
        expiresAt: permissionGrants.expiresAt,
      })
      .from(permissionGrants)
      .where(
        and(
          or(
            and(eq(permissionGrants.subjectType, 'user'), eq(permissionGrants.subjectId, userId)),
            and(eq(permissionGrants.subjectType, 'role'), inArray(permissionGrants.subjectId, roleIds as any))
          ),
          // either no expiry or expiry > now
          or(isNull(permissionGrants.expiresAt), gt(permissionGrants.expiresAt, now))
        )
      );
    return rows;
  },

  async getUserPermissions(user: AuthUser) {
    const roleIds = await this.getRoleIdsByName(user.roles || []);
    const [rolePerms, directPerms, scoped] = await Promise.all([
      this.getPermissionsForRoles(roleIds),
      this.getDirectUserPermissions(user.id),
      this.getScopedGrants(user.id, roleIds),
    ]);
    const global = new Set<string>([...rolePerms, ...directPerms]);
    return { global, scoped } as const;
  },

  async hasPermission(user: AuthUser | undefined, permission: string, resource?: ResourceContext): Promise<PermissionDecision> {
    if (!user) return { allow: false, reason: 'unauthenticated' };
    const { global, scoped } = await this.getUserPermissions(user);
    // Wildcard: any permission allowed
    if (global.has('*')) return { allow: true };
    // Global grant
    if (global.has(permission)) return { allow: true };
    // Scoped grant, if resource provided
    if (resource && resource.resource_type && resource.resource_id != null) {
      const match = scoped.find(
        g => g.permission === permission && g.resourceType === resource.resource_type && g.resourceId === resource.resource_id
      );
      if (match) return { allow: true };
      return { allow: false, reason: 'scope_mismatch' };
    }
    return { allow: false, reason: 'no_grant' };
  },
};
