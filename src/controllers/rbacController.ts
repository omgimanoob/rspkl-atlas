import { db } from '../db/client';
import { roles, permissions, rolePermissions, userRoles, permissionGrants } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { recordRbacAdmin } from '../services/audit';
import { incAdminMutation } from '../services/metrics';
import { normalizeResourceType, normalizeResourceId } from '../rbac/resources';

export const listRoles = async (_req, res) => {
  const rows = await db.select().from(roles);
  res.json(rows);
};

export const createRole = async (req, res) => {
  const name: string | undefined = req.body?.name;
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Invalid role name' });
  await db.insert(roles).values({ name }).onDuplicateKeyUpdate({ set: { name } });
  const row = await db.select().from(roles).where(eq(roles.name, name)).limit(1).then(r => r[0]);
  await recordRbacAdmin(req, 'role.create', 'role', row?.id);
  incAdminMutation();
  res.status(201).json(row);
};

export const deleteRole = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid role id' });
  await db.delete(userRoles).where(eq(userRoles.roleId, id));
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
  await db.delete(roles).where(eq(roles.id, id));
  await recordRbacAdmin(req, 'role.delete', 'role', id);
  incAdminMutation();
  res.json({ ok: true });
};

export const listPermissions = async (_req, res) => {
  const rows = await db.select().from(permissions);
  res.json(rows);
};

export const createPermission = async (req, res) => {
  const name: string | undefined = req.body?.name;
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Invalid permission name' });
  await db.insert(permissions).values({ name }).onDuplicateKeyUpdate({ set: { name } });
  const row = await db.select().from(permissions).where(eq(permissions.name, name)).limit(1).then(r => r[0]);
  await recordRbacAdmin(req, 'permission.create', 'permission', row?.id);
  incAdminMutation();
  res.status(201).json(row);
};

export const deletePermission = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid permission id' });
  await db.delete(rolePermissions).where(eq(rolePermissions.permissionId, id));
  await db.delete(permissions).where(eq(permissions.id, id));
  await recordRbacAdmin(req, 'permission.delete', 'permission', id);
  incAdminMutation();
  res.json({ ok: true });
};

export const addPermissionToRole = async (req, res) => {
  const roleId = Number(req.params.id);
  const permName = String(req.params.perm || '');
  if (!Number.isFinite(roleId) || !permName) return res.status(400).json({ error: 'Invalid role id or permission name' });
  const perm = await db.select().from(permissions).where(eq(permissions.name, permName)).limit(1).then(r => r[0]);
  if (!perm) return res.status(404).json({ error: 'Permission not found' });
  await db.insert(rolePermissions).values({ roleId, permissionId: perm.id }).onDuplicateKeyUpdate({ set: { roleId, permissionId: perm.id } });
  await recordRbacAdmin(req, 'role_permission.add', 'role', roleId);
  incAdminMutation();
  res.json({ ok: true });
};

export const removePermissionFromRole = async (req, res) => {
  const roleId = Number(req.params.id);
  const permName = String(req.params.perm || '');
  if (!Number.isFinite(roleId) || !permName) return res.status(400).json({ error: 'Invalid role id or permission name' });
  const perm = await db.select().from(permissions).where(eq(permissions.name, permName)).limit(1).then(r => r[0]);
  if (!perm) return res.status(404).json({ error: 'Permission not found' });
  await db.delete(rolePermissions).where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, perm.id)));
  await recordRbacAdmin(req, 'role_permission.remove', 'role', roleId);
  incAdminMutation();
  res.json({ ok: true });
};

export const assignRoleToUser = async (req, res) => {
  const userId = Number(req.params.id);
  const roleName = String(req.params.role || '');
  if (!Number.isFinite(userId) || !roleName) return res.status(400).json({ error: 'Invalid user id or role name' });
  const role = await db.select().from(roles).where(eq(roles.name, roleName)).limit(1).then(r => r[0]);
  if (!role) return res.status(404).json({ error: 'Role not found' });
  await db.insert(userRoles).values({ userId, roleId: role.id }).onDuplicateKeyUpdate({ set: { userId, roleId: role.id } });
  await recordRbacAdmin(req, 'user_role.add', 'user', userId);
  incAdminMutation();
  res.json({ ok: true });
};

export const removeRoleFromUser = async (req, res) => {
  const userId = Number(req.params.id);
  const roleName = String(req.params.role || '');
  if (!Number.isFinite(userId) || !roleName) return res.status(400).json({ error: 'Invalid user id or role name' });
  const role = await db.select().from(roles).where(eq(roles.name, roleName)).limit(1).then(r => r[0]);
  if (!role) return res.status(404).json({ error: 'Role not found' });
  await db.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, role.id)));
  await recordRbacAdmin(req, 'user_role.remove', 'user', userId);
  incAdminMutation();
  res.json({ ok: true });
};

export const listGrants = async (_req, res) => {
  const rows = await db.select().from(permissionGrants);
  res.json(rows);
};

export const createGrant = async (req, res) => {
  const dryRun = String(req.query?.dryRun || 'false') === 'true' || String(req.query?.dryrun || 'false') === 'true';
  const { subject_type, subject_id, permission, resource_type, resource_id, expires_at } = req.body || {};
  if (!subject_type || !['user', 'role'].includes(subject_type)) return res.status(400).json({ error: 'Invalid subject_type' });
  if (!Number.isFinite(Number(subject_id))) return res.status(400).json({ error: 'Invalid subject_id' });
  if (!permission || typeof permission !== 'string') return res.status(400).json({ error: 'Invalid permission' });
  const values: any = {
    subjectType: subject_type,
    subjectId: Number(subject_id),
    permission,
    resourceType: null as string | null,
    resourceId: null as number | null,
  };
  // Normalize resource typing if provided
  if (resource_type != null || resource_id != null) {
    const rt = normalizeResourceType(resource_type);
    if (!rt) return res.status(400).json({ error: 'Invalid resource_type' });
    const rid = normalizeResourceId(rt, resource_id);
    if (rid === null) return res.status(400).json({ error: 'Invalid resource_id' });
    values.resourceType = rt;
    values.resourceId = rid;
  }
  if (expires_at) values.expiresAt = new Date(expires_at);
  if (dryRun) return res.json({ ok: true, dryRun: true, values });
  await db.insert(permissionGrants).values(values);
  await recordRbacAdmin(req, 'grant.create', values.resourceType || null, values.resourceId || null);
  incAdminMutation();
  res.status(201).json({ ok: true });
};

export const deleteGrant = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid grant id' });
  await db.delete(permissionGrants).where(eq(permissionGrants.id, id));
  await recordRbacAdmin(req, 'grant.delete', 'grant', id);
  incAdminMutation();
  res.json({ ok: true });
};
