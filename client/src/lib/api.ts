const baseURL = import.meta.env.DEV
  ? '' // use Vite proxy if configured
  : window.location.origin

import { notifyUnauthorized } from '@/lib/auth'

async function http<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(baseURL + path, {
    ...opts,
    // Avoid conditional requests (ETag → 304) which break fetch ok path
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    credentials: 'include',
  })
  if (!res.ok) {
    let payload: any = null
    try {
      payload = await res.json()
    } catch {
      try { payload = await res.text() } catch {}
    }
    const err: any = new Error(
      (payload && typeof payload === 'object' && (payload.error || payload.reason)) ||
      (typeof payload === 'string' ? payload : '') ||
      res.statusText
    )
    err.status = res.status
    err.payload = payload
    if (res.status === 401) {
      notifyUnauthorized()
    }
    throw err
  }
  return res.json() as Promise<T>
}

export function extractApiReason(e: any): string | undefined {
  const reason = e?.payload?.reason
  if (typeof reason === 'string') return reason
  const msg = String(e?.message || '')
  // Fallback: parse simple JSON string if present in message
  try {
    const parsed = JSON.parse(msg)
    if (parsed && typeof parsed.reason === 'string') return parsed.reason
  } catch {}
  return undefined
}

export const api = {
  // Admin RBAC
  adminListRoles() { return http<Array<{ id: number; code: string; name: string }>>('/api/admin/rbac/roles') },
  adminCreateRole(payload: { code: string; name: string }) { return http<{ id: number; code: string; name: string }>(
    '/api/admin/rbac/roles', { method: 'POST', body: JSON.stringify(payload) }
  ) },
  adminDeleteRole(id: number) { return http<{ ok: boolean }>(`/api/admin/rbac/roles/${id}`, { method: 'DELETE' }) },
  adminListPermissions() { return http<Array<{ id: number; name: string }>>('/api/admin/rbac/permissions') },
  adminCreatePermission(name: string) { return http<{ id: number; name: string }>(
    '/api/admin/rbac/permissions', { method: 'POST', body: JSON.stringify({ name }) }
  ) },
  adminDeletePermission(id: number) { return http<{ ok: boolean }>(`/api/admin/rbac/permissions/${id}`, { method: 'DELETE' }) },
  adminListGrants() { return http<Array<any>>('/api/admin/rbac/grants') },
  adminCreateGrant(payload: any, dryRun?: boolean) { return http<{ ok: boolean; dryRun?: boolean }>(
    `/api/admin/rbac/grants${dryRun ? '?dryRun=1' : ''}`, { method: 'POST', body: JSON.stringify(payload) }
  ) },
  adminDeleteGrant(id: number) { return http<{ ok: boolean }>(`/api/admin/rbac/grants/${id}`, { method: 'DELETE' }) },
  adminAddPermissionToRole(roleId: number, permName: string) {
    return http<{ ok: boolean }>(`/api/admin/rbac/roles/${roleId}/permissions/${encodeURIComponent(permName)}`, { method: 'POST' })
  },
  adminRemovePermissionFromRole(roleId: number, permName: string) {
    return http<{ ok: boolean }>(`/api/admin/rbac/roles/${roleId}/permissions/${encodeURIComponent(permName)}`, { method: 'DELETE' })
  },
  adminListRolePermissions(roleId: number) { return http<string[]>(`/api/admin/rbac/roles/${roleId}/permissions`) },
  adminAssignRoleToUser(userId: number, roleName: string) {
    return http<{ ok: boolean }>(`/api/admin/rbac/users/${userId}/roles/${encodeURIComponent(roleName)}`, { method: 'POST' })
  },
  adminRemoveRoleFromUser(userId: number, roleName: string) {
    return http<{ ok: boolean }>(`/api/admin/rbac/users/${userId}/roles/${encodeURIComponent(roleName)}`, { method: 'DELETE' })
  },
  adminListUserRoles(userId: number) { return http<string[]>(`/api/admin/rbac/users/${userId}/roles`) },
  // Admin: Users
  adminListUsers(params: { page?: number; pageSize?: number; search?: string; active?: boolean; sortKey?: string; sortDir?: 'asc' | 'desc' } = {}) {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.pageSize) qs.set('pageSize', String(params.pageSize))
    if (params.search) qs.set('search', params.search)
    if (typeof params.active === 'boolean') qs.set('active', params.active ? '1' : '0')
    if (params.sortKey) qs.set('sortKey', params.sortKey)
    if (params.sortDir) qs.set('sortDir', params.sortDir)
    const query = qs.toString()
    return http<{ items: Array<{ id: number; email: string; display_name: string | null; is_active: boolean; created_at: string; updated_at: string }>; total: number; page: number; pageSize: number }>(`/api/admin/users${query ? '?' + query : ''}`)
  },
  adminUpdateUser(id: number, payload: { display_name?: string; is_active?: boolean; password?: string }) {
    return http<{ id: number; email: string; display_name: string | null; is_active: boolean; created_at: string; updated_at: string }>(
      `/api/admin/users/${id}`,
      { method: 'PUT', body: JSON.stringify(payload) }
    )
  },
  adminActivateUser(id: number) {
    return http<{ id: number; email: string; display_name: string | null; is_active: boolean }>(
      `/api/admin/users/${id}/activate`,
      { method: 'POST' }
    )
  },
  adminDeactivateUser(id: number) {
    return http<{ id: number; email: string; display_name: string | null; is_active: boolean }>(
      `/api/admin/users/${id}/deactivate`,
      { method: 'POST' }
    )
  },
  adminDeleteUser(id: number) {
    return http<{ ok: boolean }>(
      `/api/admin/users/${id}`,
      { method: 'DELETE' }
    )
  },
  adminCreateUser(payload: { email: string; password: string; display_name?: string; is_active?: boolean }) {
    return http<{ id: number; email: string; display_name: string | null; is_active: boolean; created_at: string; updated_at: string }>(
      '/api/admin/users',
      { method: 'POST', body: JSON.stringify(payload) }
    )
  },
  // Statuses lookup (admin read endpoint; consider exposing read-only for editors)
  listStatuses() {
    return http<Array<{ id: number; name: string; code: string | null; is_active: number; sort_order: number | null }>>('/api/admin/statuses')
  },
  adminCreateStatus(payload: { name: string; code?: string | null; is_active?: boolean; sort_order?: number | null }) {
    return http<{ id: number; name: string; code: string | null; is_active: number; sort_order: number | null }>(
      '/api/admin/statuses', { method: 'POST', body: JSON.stringify(payload) }
    )
  },
  adminUpdateStatus(id: number, payload: { name?: string; code?: string | null; is_active?: boolean; sort_order?: number | null }) {
    return http<{ id: number; name: string; code: string | null; is_active: number; sort_order: number | null }>(
      `/api/admin/statuses/${id}`, { method: 'PUT', body: JSON.stringify(payload) }
    )
  },
  adminDeleteStatus(id: number) {
    return http<{ ok: boolean }>(`/api/admin/statuses/${id}`, { method: 'DELETE' })
  },
  login(email: string, password: string) {
    return http<{ email: string; roles: string[] }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },
  logout() {
    return http<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
  },
  me() {
    return http<{ id: number; email: string; roles: string[]; display_name?: string | null }>('/api/me')
  },
  updateMe(payload: { display_name?: string }) {
    return http<{ id: number; email: string; display_name?: string }>(
      '/api/me',
      { method: 'PUT', body: JSON.stringify(payload || {}) }
    )
  },
  changePassword(payload: { current_password: string; new_password: string }) {
    return http<{ ok: true }>(
      '/api/me/password',
      { method: 'POST', body: JSON.stringify(payload) }
    )
  },
  requestPasswordReset(payload: { email: string }) {
    return http<{ ok: true }>(
      '/api/auth/password-reset/request',
      { method: 'POST', body: JSON.stringify(payload) }
    )
  },
  confirmPasswordReset(payload: { token: string; new_password: string }) {
    return http<{ ok: true }>(
      '/api/auth/password-reset/confirm',
      { method: 'POST', body: JSON.stringify(payload) }
    )
  },
  projects() {
    return http<any[]>('/api/projects')
  },
  // New: update status by status_id (preferred)
  updateProjectStatusById(id: number, statusId: number) {
    return http<{ message: string }>('/api/overrides/status', {
      method: 'PUT',
      body: JSON.stringify({ id, status_id: statusId }),
    })
  },
  // New: update overrides using status_id (preferred)
  updateProjectOverridesById(
    id: number,
    overrides: { statusId?: number; moneyCollected?: number; isProspective?: boolean }
  ) {
    const body: any = { id }
    if (overrides.statusId !== undefined) body.status_id = overrides.statusId
    if (overrides.moneyCollected !== undefined) body.money_collected = overrides.moneyCollected
    if (overrides.isProspective !== undefined) body.is_prospective = overrides.isProspective
    return http<any>('/api/overrides', {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  },
  // Deprecated: string-based status updates (kept temporarily until UI migrates)
  updateProjectStatus(id: number, status: string) {
    return http<{ message: string }>('/api/overrides/status', {
      method: 'PUT',
      body: JSON.stringify({ id, status }),
    })
  },
  updateProjectOverrides(id: number, overrides: { status?: string; moneyCollected?: number; isProspective?: boolean }) {
    const body: any = { id }
    if (overrides.status !== undefined) body.status = overrides.status
    if (overrides.moneyCollected !== undefined) body.money_collected = overrides.moneyCollected
    if (overrides.isProspective !== undefined) body.is_prospective = overrides.isProspective
    return http<any>('/api/overrides', {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  },
}
