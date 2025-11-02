import request from 'supertest'
import { app } from '../../src/index'
import { db } from '../../src/db/client'
import { users, roles, userRoles } from '../../src/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { atlasPool } from '../../db'

async function ensureRole(code: string, name?: string) {
  await db.insert(roles).values({ code, name: name || code }).onDuplicateKeyUpdate({ set: { name: name || code } })
  return db.select({ id: roles.id }).from(roles).where(eq(roles.code, code)).limit(1).then(r => r[0])
}

describe('Admin Statuses unique code inference', () => {
  const agent = request.agent(app)
  const adminEmail = `status.unique.${Date.now()}@example.com`
  const pwd = 'Secret123!'
  let createdIds: number[] = []
  let adminUserId: number | null = null
  let statusSuffix: number | null = null

  beforeAll(async () => {
    const hash = await bcrypt.hash(pwd, 12)
    await db.insert(users).values({ email: adminEmail, passwordHash: hash, displayName: 'Statuses Admin', isActive: 1 }).onDuplicateKeyUpdate({ set: { email: adminEmail } })
    const user = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail)).limit(1).then(r => r[0])
    adminUserId = user?.id ?? null
    const admins = await ensureRole('admins', 'Administrator')
    await db.insert(userRoles).values({ userId: user.id, roleId: admins.id }).onDuplicateKeyUpdate({ set: { userId: user.id, roleId: admins.id } })
    await agent.post('/api/auth/login').send({ email: adminEmail, password: pwd }).expect(200)
  })

  afterAll(async () => {
    await agent.post('/api/auth/logout').expect(200)
    // Cleanup statuses created in this test
    for (const id of createdIds) {
      try { await agent.delete(`/api/admin/statuses/${id}`).expect(200) } catch {
        try { await atlasPool.query('DELETE FROM project_statuses WHERE id = ?', [id]) } catch {}
      }
    }
    if (statusSuffix !== null) {
      try {
        await atlasPool.query(
          'DELETE FROM project_statuses WHERE name IN (?, ?)',
          [`Design Stage ${statusSuffix}`, `Design-Stage ${statusSuffix}`]
        )
      } catch {}
    }
    if (adminUserId !== null) {
      try { await db.delete(userRoles).where(eq(userRoles.userId, adminUserId)) } catch {}
      try { await db.delete(users).where(eq(users.id, adminUserId)) } catch {}
    }
  })

  it('generates a unique code when two names slug to the same base', async () => {
    statusSuffix = Date.now()
    const name1 = `Design Stage ${statusSuffix}` // slug: design-stage-${suffix}
    const name2 = `Design-Stage ${statusSuffix}` // slug: design-stage-${suffix} (same base)
    const s1 = await agent.post('/api/admin/statuses').send({ name: name1 }).expect(201)
    createdIds.push(s1.body.id)
    const s2 = await agent.post('/api/admin/statuses').send({ name: name2 }).expect(201)
    createdIds.push(s2.body.id)
    expect(typeof s1.body.code).toBe('string')
    expect(typeof s2.body.code).toBe('string')
    expect(s1.body.code).not.toBe('')
    expect(s2.body.code).not.toBe('')
    expect(s1.body.code).not.toBe(s2.body.code)
    // Expect suffix numbering (e.g., design-stage and design-stage-2)
    expect(s2.body.code.startsWith(s1.body.code) || s2.body.code.startsWith(s1.body.code.replace(/-\d+$/, ''))).toBeTruthy()
  })
})
