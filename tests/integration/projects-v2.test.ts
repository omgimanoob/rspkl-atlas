import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '../../src/index'
import { db } from '../../src/db/client'
import { users, roles, userRoles, permissions, rolePermissions } from '../../src/db/schema'
import { eq } from 'drizzle-orm'
import { atlasPool } from '../../db'

jest.setTimeout(30000)

async function ensureRole(code: string, displayName?: string) {
  await db.insert(roles).values({ code, name: displayName || code }).onDuplicateKeyUpdate({ set: { name: displayName || code } })
  return db.select({ id: roles.id, code: roles.code, name: roles.name }).from(roles).where(eq(roles.code, code)).limit(1).then(r => r[0])
}

async function ensurePermission(name: string) {
  await db.insert(permissions).values({ name }).onDuplicateKeyUpdate({ set: { name } })
  return db.select({ id: permissions.id, name: permissions.name }).from(permissions).where(eq(permissions.name, name)).limit(1).then(r => r[0])
}

async function mapRolePermission(roleId: number, permissionId: number) {
  await db.insert(rolePermissions).values({ roleId, permissionId }).onDuplicateKeyUpdate({ set: { roleId, permissionId } })
}

describe('Projects v2 – sorting and filters', () => {
  const agent = request.agent(app)
  const email = `pv2.tester.${Date.now()}@example.com`
  const pwd = 'Secret123!'
  let createdAtlasIds: number[] = []
  let statusAlpha: number | null = null
  let statusBeta: number | null = null
  const NAME_PREFIX = `PV2-${Date.now()}`

  beforeAll(async () => {
    // Create admin-like user with wildcard permission
    const hash = await bcrypt.hash(pwd, 12)
    await db.insert(users).values({ email, passwordHash: hash, displayName: 'PV2 Tester', isActive: 1 }).onDuplicateKeyUpdate({ set: { email } })
    const u = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0])
    const admins = await ensureRole('admins', 'Administrator')
    const star = await ensurePermission('*')
    await mapRolePermission(admins.id, star.id)
    await db.insert(userRoles).values({ userId: u.id, roleId: admins.id }).onDuplicateKeyUpdate({ set: { userId: u.id, roleId: admins.id } })
    await agent.post('/api/auth/login').send({ email, password: pwd }).expect(200)

    // Create two statuses via admin API for consistent filtering
    const a = await agent.post('/api/admin/statuses').send({ name: `Alpha-${Date.now()}` }).expect(201)
    statusAlpha = a.body.id
    const b = await agent.post('/api/admin/statuses').send({ name: `Beta-${Date.now()}` }).expect(201)
    statusBeta = b.body.id

    // Create 3 prospective projects with varying names/api/statuses
    const p1 = await agent.post('/api/v2/prospective').send({ name: `${NAME_PREFIX}-A`, status_id: statusAlpha }).expect(201)
    const p2 = await agent.post('/api/v2/prospective').send({ name: `${NAME_PREFIX}-B`, status_id: statusBeta }).expect(201)
    const p3 = await agent.post('/api/v2/prospective').send({ name: `${NAME_PREFIX}-C` }).expect(201)
    createdAtlasIds = [p1.body.atlasId, p2.body.atlasId, p3.body.atlasId]
  })

  afterAll(async () => {
    // Cleanup created atlas rows
    for (const id of createdAtlasIds) {
      try { await atlasPool.query('DELETE FROM atlas_projects WHERE id = ?', [id]) } catch {}
    }
    await agent.post('/api/auth/logout').expect(200)
  })

  it('filters Prospective only (include=atlas) and searches by name', async () => {
    const listAll = await agent.get(`/api/v2/projects?include=atlas&q=${encodeURIComponent(NAME_PREFIX)}&pageSize=50`).expect(200)
    expect(Array.isArray(listAll.body.items)).toBe(true)
    // All returned items should be origin atlas and prospective true
    for (const it of listAll.body.items) {
      expect(it.origin).toBe('atlas')
      expect(it.isProspective).toBe(true)
    }
    const searchB = await agent.get(`/api/v2/projects?include=atlas&q=${encodeURIComponent(NAME_PREFIX + '-B')}&pageSize=50`).expect(200)
    expect(searchB.body.items.some((r: any) => r.displayName === `${NAME_PREFIX}-B`)).toBe(true)
    expect(searchB.body.items.every((r: any) => r.displayName.includes(`${NAME_PREFIX}-B`))).toBe(true)
  })

  it('returns mixed sources by default when include param is omitted', async () => {
    const res = await agent.get('/api/v2/projects?pageSize=10').expect(200)
    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body.items.length).toBeGreaterThanOrEqual(0)
    const origins = new Set(res.body.items.map((r: any) => r.origin))
    expect(origins.has('kimai') || origins.has('atlas')).toBe(true)
    expect(res.body.counts?.kimai ?? 0).toBeGreaterThanOrEqual(0)
    expect(res.body.counts?.atlas ?? 0).toBeGreaterThanOrEqual(0)
  })

  it('sorts by name ascending and descending', async () => {
    const asc = await agent.get(`/api/v2/projects?include=atlas&sort=displayName:asc&q=${encodeURIComponent(NAME_PREFIX)}`).expect(200)
    const namesAsc = asc.body.items.map((r: any) => r.displayName)
    const desc = await agent.get(`/api/v2/projects?include=atlas&sort=displayName:desc&q=${encodeURIComponent(NAME_PREFIX)}`).expect(200)
    const namesDesc = desc.body.items.map((r: any) => r.displayName)
    const expectedAsc = namesAsc.slice().sort((a: string, b: string) => a.localeCompare(b))
    const expectedDesc = namesDesc.slice().sort((a: string, b: string) => b.localeCompare(a))
    expect(expectedAsc).toEqual(namesAsc)
    expect(expectedDesc).toEqual(namesDesc)
  })

  it('filters by statusId', async () => {
    const byAlpha = await agent.get(`/api/v2/projects?include=atlas&statusId=${statusAlpha}`).expect(200)
    expect(byAlpha.body.items.every((r: any) => r.statusId === statusAlpha)).toBe(true)
  })

  it('filters projects with no status when statusNull=1', async () => {
    const res = await agent.get(`/api/v2/projects?include=atlas&statusNull=1`).expect(200)
    expect(res.body.items.length).toBeGreaterThanOrEqual(1)
    expect(res.body.items.every((r: any) => r.statusId == null)).toBe(true)
  })

  it('paginates results (scoped to NAME_PREFIX)', async () => {
    const page1 = await agent.get(`/api/v2/projects?include=atlas&q=${encodeURIComponent(NAME_PREFIX)}&page=1&pageSize=1&sort=displayName:asc`).expect(200)
    const page2 = await agent.get(`/api/v2/projects?include=atlas&q=${encodeURIComponent(NAME_PREFIX)}&page=2&pageSize=1&sort=displayName:asc`).expect(200)
    expect(page1.body.items.length).toBe(1)
    expect(page2.body.items.length).toBe(1)
    expect(page1.body.items[0].displayName).not.toBe(page2.body.items[0].displayName)
    expect(page1.body.total).toBeGreaterThanOrEqual(2)
  })

  it('combines filters: statusId + isProspective + sorting', async () => {
    // Expect only prospective (atlas) rows with status=Beta, sorted by name desc
    const res = await agent.get(`/api/v2/projects?include=atlas&isProspective=1&statusId=${statusBeta}&sort=displayName:desc`).expect(200)
    expect(Array.isArray(res.body.items)).toBe(true)
    // Every row should be atlas + prospective = true + Beta status
    for (const it of res.body.items) {
      expect(it.origin).toBe('atlas')
      expect(it.isProspective).toBe(true)
      expect(it.statusId).toBe(statusBeta)
    }
    // If at least 2 rows, verify ordering by name desc
    if (res.body.items.length >= 2) {
      const names = res.body.items.map((r: any) => r.displayName)
      expect(names.slice().sort().reverse()).toEqual(names)
    }
  })

  it('combines search + statusId + pagination deterministically', async () => {
    // Search for projects containing NAME_PREFIX, filter by Alpha|Beta, sort by name asc, page size 2
    const res = await agent.get(`/api/v2/projects?include=atlas&q=${encodeURIComponent(NAME_PREFIX)}&statusId=${statusAlpha},${statusBeta}&sort=displayName:asc&page=1&pageSize=2`).expect(200)
    expect(res.body.items.length).toBeGreaterThanOrEqual(1)
    // Names should be ordered asc and match the search
    const names = res.body.items.map((r: any) => r.displayName)
    const expected = names.slice().sort((a: string, b: string) => a.localeCompare(b))
    expect(expected).toEqual(names)
    expect(names.every((n: string) => n.includes(NAME_PREFIX))).toBe(true)
    // Status facets should contain Alpha and/or Beta when present
    const facets: Array<{ id: number; name: string; count: number }> = res.body.statusFacets || []
    expect(Array.isArray(facets)).toBe(true)
    const fIds = new Set(facets.map(f => f.id))
    // At least one of the selected statuses should appear in facets
    expect(fIds.has(statusAlpha!) || fIds.has(statusBeta!)).toBe(true)
  })

  it('returns counts per origin in the list response', async () => {
    const res = await agent.get('/api/v2/projects?include=kimai,atlas&pageSize=1').expect(200)
    expect(res.body.counts).toBeDefined()
    expect(typeof res.body.counts.kimai).toBe('number')
    expect(typeof res.body.counts.atlas).toBe('number')
    // atlas count should be >= 3 due to created rows
    expect(res.body.counts.atlas).toBeGreaterThanOrEqual(3)
  })

  it('sorts by updatedAt when an item is edited (desc)', async () => {
    // Edit one of the created Prospective rows to bump updatedAt
    // Choose the B row by searching
    const list = await agent.get(`/api/v2/projects?include=atlas&q=${encodeURIComponent(NAME_PREFIX + '-B')}&pageSize=1`).expect(200)
    const row = list.body.items[0]
    expect(row.displayName).toBe(`${NAME_PREFIX}-B`)
    await agent.put(`/api/v2/prospective/${row.atlasId}`).send({ notes: 'bump' }).expect(200)
    const after = await agent.get(`/api/v2/projects?include=atlas&q=${encodeURIComponent(NAME_PREFIX)}&sort=updatedAt:desc&pageSize=3`).expect(200)
    const names = after.body.items.map((r: any) => r.displayName)
    expect(names[0]).toBe(`${NAME_PREFIX}-B`)
  })

  it('source filter combinations: both, kimai-only, atlas-only, none', async () => {
    const both = await agent.get('/api/v2/projects?include=kimai,atlas&pageSize=1').expect(200)
    expect(both.body.items.length).toBeGreaterThanOrEqual(0)
    const kimaiOnly = await agent.get('/api/v2/projects?include=kimai&pageSize=1').expect(200)
    expect(kimaiOnly.body.items.every((r: any) => r.origin === 'kimai')).toBe(true)
    const atlasOnly = await agent.get('/api/v2/projects?include=atlas&pageSize=1').expect(200)
    expect(atlasOnly.body.items.every((r: any) => r.origin === 'atlas')).toBe(true)
    // include parameter present but empty -> none
    const none = await agent.get('/api/v2/projects?include=').expect(200)
    expect(Array.isArray(none.body.items)).toBe(true)
    expect(none.body.items.length).toBe(0)
  })
})
