import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '../../src/index'
import { db } from '../../src/db/client'
import { users, roles, userRoles } from '../../src/db/schema'
import { eq } from 'drizzle-orm'

jest.setTimeout(30000)

async function ensureRole(code: string, displayName?: string) {
  await db.insert(roles).values({ code, name: displayName || code }).onDuplicateKeyUpdate({ set: { name: displayName || code } })
  return db.select({ id: roles.id }).from(roles).where(eq(roles.code, code)).limit(1).then(r => r[0])
}

async function createUserWithRole(email: string, password: string, roleCode: string) {
  const hash = await bcrypt.hash(password, 12)
  await db.insert(users).values({ email, passwordHash: hash, displayName: 'Statuses User', isActive: 1 }).onDuplicateKeyUpdate({ set: { email } })
  const u = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0])
  const role = await ensureRole(roleCode)
  await db.insert(userRoles).values({ userId: u.id, roleId: role.id }).onDuplicateKeyUpdate({ set: { userId: u.id, roleId: role.id } })
  return u
}

describe('Public statuses lookup (GET /api/statuses)', () => {
  const agent = request.agent(app)
  const email = `pub.statuses.${Date.now()}@example.com`
  const pwd = 'Secret123!'

  beforeAll(async () => {
    await createUserWithRole(email, pwd, 'hr')
    await agent.post('/api/auth/login').send({ email, password: pwd }).expect(200)
  })

  afterAll(async () => {
    await agent.post('/api/auth/logout').expect(200)
  })

  it('returns 200 with a list of statuses', async () => {
    const res = await agent.get('/api/statuses').expect(200)
    expect(Array.isArray(res.body)).toBe(true)
    // Elements should have id/name shape when present
    if (res.body.length) {
      expect(res.body[0]).toHaveProperty('id')
      expect(res.body[0]).toHaveProperty('name')
    }
  })
})

