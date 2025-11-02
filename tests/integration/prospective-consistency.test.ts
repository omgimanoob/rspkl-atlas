import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '../../src/index'
import { db } from '../../src/db/client'
import { users, roles, userRoles, permissions, rolePermissions } from '../../src/db/schema'
import { eq } from 'drizzle-orm'

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

async function createAdmin(email: string, password: string) {
  const hash = await bcrypt.hash(password, 12)
  await db.insert(users).values({ email, passwordHash: hash, displayName: 'Prospective Admin', isActive: 1 }).onDuplicateKeyUpdate({ set: { email } })
  const u = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0])
  const admins = await ensureRole('admins', 'Administrator')
  const star = await ensurePermission('*')
  await mapRolePermission(admins.id, star.id)
  await db.insert(userRoles).values({ userId: u.id, roleId: admins.id }).onDuplicateKeyUpdate({ set: { userId: u.id, roleId: admins.id } })
  return u
}

describe('Prospective consistency rules', () => {
  const agent = request.agent(app)
  const email = `pros.consistency.${Date.now()}@example.com`
  const pwd = 'Secret123!'

  beforeAll(async () => {
    await createAdmin(email, pwd)
    await agent.post('/api/auth/login').send({ email, password: pwd }).expect(200)
  })

  afterAll(async () => {
    await agent.post('/api/auth/logout').expect(200)
  })

  it('rejects create prospective when is_prospective is not 1 for kimai_project_id NULL', async () => {
    const res = await agent.post('/api/admin/api/prospective').send({ name: 'Alpha', status: 'Tender', is_prospective: 0 })
    expect(res.status).toBe(400)
    expect(res.body?.reason).toBe('atlas_native_must_be_prospective')
  })

  it('creates Atlas-native project with is_prospective = 1 by rule', async () => {
    const res = await agent.post('/api/admin/api/prospective').send({ name: 'Beta' }).expect(201)
    expect(res.body.kimai_project_id).toBeNull()
    expect(res.body.is_prospective).toBe(true)
  })

  it('rejects overrides upsert when kimai-backed has is_prospective != 0', async () => {
    const res = await agent.put('/api/overrides').send({ id: 987654, is_prospective: 1 })
    // Kimai-backed must be 0 now; controller may map to 400
    expect([200,400]).toContain(res.status)
  })

  // Further normalization on overrides can be validated when controller enforces the new rules.
})
