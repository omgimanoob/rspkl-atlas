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

describe('Prospective create (POST /api/prospective)', () => {
  const agent = request.agent(app)
  const email = `pros.create.${Date.now()}@example.com`
  const pwd = 'Secret123!'
  let createdId: number | undefined

  beforeAll(async () => {
    // Create an admin-like role with '*' so no need to seed specific permission
    const hash = await bcrypt.hash(pwd, 12)
    await db.insert(users).values({ email, passwordHash: hash, displayName: 'Prospective Creator', isActive: 1 }).onDuplicateKeyUpdate({ set: { email } })
    const u = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0])
    const admins = await ensureRole('admins', 'Administrator')
    const star = await ensurePermission('*')
    await mapRolePermission(admins.id, star.id)
    await db.insert(userRoles).values({ userId: u.id, roleId: admins.id }).onDuplicateKeyUpdate({ set: { userId: u.id, roleId: admins.id } })
    await agent.post('/api/auth/login').send({ email, password: pwd }).expect(200)
  })

  afterAll(async () => {
    await agent.post('/api/auth/logout').expect(200)
    if (createdId) {
      try { await (atlasPool as any).query('DELETE FROM project_overrides WHERE id = ?', [createdId]) } catch {}
    }
  })

  it('creates an Atlas-native prospective row with is_prospective=false', async () => {
    const res = await agent.post('/api/prospective').send({ name: 'UI Draft', notes: 'created via test' }).expect(201)
    expect(res.body.kimai_project_id).toBeNull()
    expect(res.body.is_prospective).toBe(false)
    createdId = res.body.id
  })
})

