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
  payments: {
    list(params: { q?: string; page?: number; pageSize?: number; sort?: string; kimai?: number } = {}) {
      const qs = new URLSearchParams()
      if (params.q) qs.set('q', params.q)
      if (params.page) qs.set('page', String(params.page))
      if (params.pageSize) qs.set('pageSize', String(params.pageSize))
      if (params.sort) qs.set('sort', params.sort)
      if (params.kimai != null) qs.set('kimai', String(params.kimai))
      const q = qs.toString()
      return http<{ items: Array<{ id: number; kimai_project_id: number; amount: number; notes?: string | null; payment_date: string; created_at: string; created_by?: number | null; created_by_display?: string | null; project_name?: string | null; project_comment?: string | null; override_notes?: string | null }>; total: number; page: number; pageSize: number }>(`/api/payments${q ? ('?' + q) : ''}`)
    },
    create(payload: { kimai_project_id: number; amount: number; payment_date: string; notes?: string | null }) {
      return http<{ id: number; kimai_project_id: number; amount: number; payment_date: string; notes?: string | null; created_by?: number | null; money_collected: number }>(
        '/api/payments', { method: 'POST', body: JSON.stringify(payload) }
      )
    },
    recalc(kimaiId: number) {
      return http<{ ok: true; kimai_project_id: number; money_collected: number }>(`/api/payments/recalc/${kimaiId}`, { method: 'POST' })
    },
  },
  studios: {
    list() { return http<{ items: Array<{ id: number; name: string; team_count?: number; director_count?: number }> }>(`/api/studios`) },
    create(name: string) { return http<{ id: number; name: string }>(`/api/studios`, { method: 'POST', body: JSON.stringify({ name }) }) },
    update(id: number, name: string) { return http<{ id: number; name: string }>(`/api/studios/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }) },
    remove(id: number) { return http<{ ok: boolean }>(`/api/studios/${id}`, { method: 'DELETE' }) },
    teams(id: number) { return http<{ items: Array<{ team_id: number; name: string; color?: string | null }> }>(`/api/studios/${id}/teams`) },
    addTeam(id: number, teamId: number) { return http<{ ok: boolean }>(`/api/studios/${id}/teams`, { method: 'POST', body: JSON.stringify({ kimai_team_id: teamId }) }) },
    removeTeam(id: number, teamId: number) { return http<{ ok: boolean }>(`/api/studios/${id}/teams/${teamId}`, { method: 'DELETE' }) },
    directors(id: number) { return http<{ items: Array<{ user_id: number; username?: string | null; email?: string | null }> }>(`/api/studios/${id}/directors`) },
    addDirector(id: number, userId: number) { return http<{ ok: boolean }>(`/api/studios/${id}/directors`, { method: 'POST', body: JSON.stringify({ replica_kimai_user_id: userId }) }) },
    removeDirector(id: number, userId: number) { return http<{ ok: boolean }>(`/api/studios/${id}/directors/${userId}`, { method: 'DELETE' }) },
  },
  teams() { return http<{ items: Array<{ id: number; name: string; color?: string | null }> }>(`/api/teams`) },
  kimaiUsers() { return http<{ items: Array<{ id: number; username: string; alias?: string | null; email: string; enabled: number }> }>(`/api/kimai-users`) },
  sync: {
    healthz() {
      return http<{ ok: boolean; db: boolean }>(
        '/api/healthz'
      )
    },
    health() {
      return http<{ state: Record<string, { value: string; updated_at: string }>; counts: Record<string, number> }>(
        '/api/sync/health'
      )
    },
    projects() {
      return http<{ message: string }>(
        '/api/sync/projects',
        { method: 'POST' }
      )
    },
    timesheets() {
      return http<{ message: string }>(
        '/api/sync/timesheets',
        { method: 'POST' }
      )
    },
    users() {
      return http<{ message: string }>(
        '/api/sync/users',
        { method: 'POST' }
      )
    },
    activities() {
      return http<{ message: string }>(
        '/api/sync/activities',
        { method: 'POST' }
      )
    },
    teams() {
      return http<{ message: string }>(
        '/api/sync/teams',
        { method: 'POST' }
      )
    },
    teamsUsers() {
      return http<{ message: string }>(
        '/api/sync/teams-users',
        { method: 'POST' }
      )
    },
    tags() {
      return http<{ message: string }>(
        '/api/sync/tags',
        { method: 'POST' }
      )
    },
    tsmeta() {
      return http<{ message: string }>(
        '/api/sync/tsmeta',
        { method: 'POST' }
      )
    },
    customers() {
      return http<{ message: string }>(
        '/api/sync/customers',
        { method: 'POST' }
      )
    },
    verify() {
      return http<{ totals: Array<{ name: string; kimai: number; replica: number; diff: number; ok: boolean }>; recent: { days: number; kimai: number; replica: number; diff: number; ok: boolean }; tolerance: number }>(
        '/api/sync/verify'
      )
    },
    clear(kind: 'projects' | 'timesheets' | 'users' | 'activities' | 'tags' | 'timesheet_tags' | 'customers' | 'teams' | 'users_teams') {
      return http<{ ok: true; table: string }>(`/api/sync/clear/${encodeURIComponent(kind)}`, { method: 'POST' })
    }
  },
  // V2 Projects API
  v2: {
    projects(opts: { include?: Array<'kimai' | 'atlas' | 'prospective'>; q?: string; page?: number; pageSize?: number; sort?: string; statusIds?: number[]; statusNull?: boolean; isProspective?: boolean } = {}) {
      const qs = new URLSearchParams()
      if (opts.include) {
        // Send 'include' key even when empty to indicate no sources selected
        qs.set('include', opts.include.length ? opts.include.join(',') : '')
      }
      if (opts.q) qs.set('q', opts.q)
      if (opts.page) qs.set('page', String(opts.page))
      if (opts.pageSize) qs.set('pageSize', String(opts.pageSize))
      if (opts.sort) qs.set('sort', opts.sort)
      if (opts.statusIds && opts.statusIds.length) qs.set('statusId', opts.statusIds.join(','))
      if (opts.statusNull) qs.set('statusNull', '1')
      if (typeof opts.isProspective === 'boolean') qs.set('isProspective', opts.isProspective ? '1' : '0')
      const q = qs.toString()
      return http<{ items: any[]; total: number; page: number; pageSize: number; counts?: { kimai: number; atlas: number }; statusFacets?: Array<{ id: number; name: string | null; count: number }> }>(`/api/v2/projects${q ? ('?' + q) : ''}`)
    },
    listStatuses() { return http<Array<{ id: number; name: string; code: string | null; color?: string | null; is_active: number; sort_order: number | null }>>('/api/v2/statuses') },
    createProspective(payload: { name: string; status_id?: number; notes?: string }) {
      return http<any>('/api/v2/prospective', { method: 'POST', body: JSON.stringify(payload) })
    },
    updateProspective(id: number, payload: { name?: string; status_id?: number | null; notes?: string | null }) {
      return http<any>(`/api/v2/prospective/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
    },
    linkProspective(id: number, kimaiId: number) {
      return http<any>(`/api/v2/prospective/${id}/link`, { method: 'POST', body: JSON.stringify({ kimai_project_id: kimaiId }) })
    },
    updateKimaiOverrides(kimaiId: number, payload: { status_id?: number | null; money_collected?: number | null; notes?: string | null }) {
      return http<any>(`/api/v2/projects/${kimaiId}/overrides`, { method: 'PUT', body: JSON.stringify(payload) })
    },
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
    return http<Array<{ id: number; name: string; code: string | null; color?: string | null; is_active: number; sort_order: number | null }>>('/api/admin/statuses')
  },
  // Public (read-only) statuses list for UI dropdowns
  listStatusesPublic() {
    return http<Array<{ id: number; name: string; code: string | null; color?: string | null; is_active: number; sort_order: number | null }>>('/api/statuses')
  },
  adminCreateStatus(payload: { name: string; code?: string | null; color?: string | null; is_active?: boolean; sort_order?: number | null }) {
    return http<{ id: number; name: string; code: string | null; color?: string | null; is_active: number; sort_order: number | null }>(
      '/api/admin/statuses', { method: 'POST', body: JSON.stringify(payload) }
    )
  },
  adminUpdateStatus(id: number, payload: { name?: string; code?: string | null; color?: string | null; is_active?: boolean; sort_order?: number | null }) {
    return http<{ id: number; name: string; code: string | null; color?: string | null; is_active: number; sort_order: number | null }>(
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
  projects(opts: { include?: Array<'kimai' | 'atlas' | 'prospective'>; includeProspective?: boolean } = {}) {
    const qs = new URLSearchParams()
    if (opts.include && opts.include.length) {
      const set = new Set(opts.include.map(v => (v === 'prospective' ? 'atlas' : v)))
      qs.set('include', Array.from(set).join(','))
    } else if (opts.includeProspective) {
      qs.set('includeProspective', '1')
    }
    const q = qs.toString()
    return http<any[]>(`/api/projects${q ? ('?' + q) : ''}`)
  },
  // Create an Atlas-native prospective project (kimai_project_id = null)
  createProspective(payload: { name: string; status_id?: number; notes?: string }) {
    return http<{ id: number; kimai_project_id: null; is_prospective: boolean; name?: string; status?: string | null; notes?: string | null }>(
      '/api/prospective',
      { method: 'POST', body: JSON.stringify(payload) }
    )
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
