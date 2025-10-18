import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import { users, roles, userRoles, permissionGrants, permissions, rolePermissions } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

jest.setTimeout(30000);

// Mock heavy data services to avoid external DB calls
jest.mock('../../src/services/kimai', () => ({
  Kimai: {
    getProjects: jest.fn().mockResolvedValue([]),
    getDetailedTimesheets: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock('../../src/services/biService', () => ({
  BIService: {
    getCustomerProjectHours: jest.fn().mockResolvedValue([]),
    shapeSunburst: jest.fn().mockImplementation((rows) => rows),
  },
}));
jest.mock('../../src/services/timesheetSync', () => ({
  TimesheetSync: {
    syncTimesheets: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock overrides service to avoid dependence on overrides_projects table
jest.mock('../../src/services/projectOverrides', () => ({
  ProjectOverrides: {
    getAll: jest.fn().mockResolvedValue([]),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    upsertOverrides: jest.fn().mockResolvedValue({}),
  },
}));

// Avoid 5s artificial delay in updateProjectOverridesHandler
jest.mock('../../src/controllers/projectOverridesController', () => {
  const original = jest.requireActual('../../src/controllers/projectOverridesController');
  return {
    ...original,
    updateProjectOverridesHandler: (req, res) => res.json({ ok: true }),
  };
});

async function ensureRole(roleName: string) {
  await db.insert(roles).values({ name: roleName }).onDuplicateKeyUpdate({ set: { name: roleName } });
  return db.select({ id: roles.id }).from(roles).where(eq(roles.name, roleName)).limit(1).then(r => r[0]);
}

async function ensurePermission(name: string) {
  await db.insert(permissions).values({ name }).onDuplicateKeyUpdate({ set: { name } });
  return db.select({ id: permissions.id }).from(permissions).where(eq(permissions.name, name)).limit(1).then(r => r[0]);
}

async function createUser(email: string, password: string, roleNames: string[] = []) {
  const hash = await bcrypt.hash(password, 12);
  await db.insert(users).values({ email, passwordHash: hash, displayName: 'ITest', isActive: 1 }).onDuplicateKeyUpdate({ set: { email } });
  const user = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0]);
  for (const rn of roleNames) {
    const role = await ensureRole(rn);
    await db.insert(userRoles).values({ userId: user.id, roleId: role.id }).onDuplicateKeyUpdate({ set: { userId: user.id, roleId: role.id } });
  }
  return user;
}

async function deleteUser(email: string) {
  const u = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(r => r[0]);
  if (u) {
    await db.delete(userRoles).where(eq(userRoles.userId, u.id));
    await db.delete(permissionGrants).where(eq(permissionGrants.subjectId, u.id));
    await db.delete(users).where(eq(users.id, u.id));
  }
}

async function login(agent: any, email: string, password: string) {
  return agent.post('/auth/login').send({ email, password }).expect(200);
}

describe('Permission-protected routes (dual-gate)', () => {
  const agent = request.agent(app);
  const pwd = 'Secret123!';
  const hrEmail = 'perm.hr@example.com';
  const mgmtEmail = 'perm.mgmt@example.com';
  const dirEmail = 'perm.dir@example.com';
  const adminEmail = 'perm.admin@example.com';
  const basicEmail = 'perm.basic@example.com';
  const scopedEmail = 'perm.scoped@example.com';
  const wildcardEmail = 'perm.wildcard@example.com';

  beforeAll(async () => {
    await createUser(hrEmail, pwd, ['hr']);
    await createUser(mgmtEmail, pwd, ['management']);
    await createUser(dirEmail, pwd, ['directors']);
    await createUser(adminEmail, pwd, ['admins']);
    await createUser(basicEmail, pwd, []);
    const scopedUser = await createUser(scopedEmail, pwd, []);
    // Scoped grant: allow overrides:update only for project 123 for this user
    await db.insert(permissionGrants).values({
      subjectType: 'user',
      subjectId: scopedUser.id,
      permission: 'overrides:update',
      resourceType: 'project',
      resourceId: 123,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Wildcard-only user: role mapped to '*' permission, no privileged roles
    const wildcardRole = await ensureRole('wildcard_only');
    const star = await ensurePermission('*');
    await db.insert(rolePermissions).values({ roleId: wildcardRole.id, permissionId: star.id }).onDuplicateKeyUpdate({ set: { roleId: wildcardRole.id, permissionId: star.id } });
    await createUser(wildcardEmail, pwd, ['wildcard_only']);
  });

  afterAll(async () => {
    for (const email of [hrEmail, mgmtEmail, dirEmail, adminEmail, basicEmail, scopedEmail, wildcardEmail]) {
      await deleteUser(email);
    }
  });

  it('GET /projects: hr allowed, basic denied', async () => {
    await login(agent, hrEmail, pwd);
    await agent.get('/projects').expect(200);
    await agent.post('/auth/logout').expect(200);

    await login(agent, basicEmail, pwd);
    await agent.get('/projects').expect(403);
    await agent.post('/auth/logout').expect(200);
  });

  it('Unauthenticated: protected routes return 401', async () => {
    // no login
    await agent.get('/projects').expect(401);
  });

  it('GET /timesheets: management allowed, basic denied', async () => {
    await login(agent, mgmtEmail, pwd);
    await agent.get('/timesheets').expect(200);
    await agent.post('/auth/logout').expect(200);

    await login(agent, basicEmail, pwd);
    await agent.get('/timesheets').expect(403);
    await agent.post('/auth/logout').expect(200);
  });

  it('GET /bi/sunburst: directors allowed, basic denied', async () => {
    await login(agent, dirEmail, pwd);
    await agent.get('/bi/sunburst').expect(200);
    await agent.post('/auth/logout').expect(200);

    await login(agent, basicEmail, pwd);
    await agent.get('/bi/sunburst').expect(403);
    await agent.post('/auth/logout').expect(200);
  });

  it('PUT /overrides/status: scoped user allowed for project 123, denied for 999', async () => {
    await login(agent, scopedEmail, pwd);
    await agent
      .put('/overrides/status')
      .send({ id: 123, status: 'active' })
      .expect(200);
    await agent
      .put('/overrides/status')
      .send({ id: 999, status: 'active' })
      .expect(403);
    await agent.post('/auth/logout').expect(200);
  });

  it('PUT /overrides: scoped user allowed for project 123, denied for 999', async () => {
    await login(agent, scopedEmail, pwd);
    await agent
      .put('/overrides')
      .send({ id: 123, status: 'active' })
      .expect(200);
    await agent
      .put('/overrides')
      .send({ id: 999, status: 'active' })
      .expect(403);
// Increase timeout due to endpoints that include artificial delays
jest.setTimeout(30000);
    await agent.post('/auth/logout').expect(200);
  });

  it('POST /sync/timesheets: admins allowed, others denied', async () => {
    await login(agent, adminEmail, pwd);
    await agent.post('/sync/timesheets').expect(200);
    await agent.post('/auth/logout').expect(200);

    await login(agent, basicEmail, pwd);
    await agent.post('/sync/timesheets').expect(403);
    await agent.post('/auth/logout').expect(200);
  });

  it("Wildcard-only user can access endpoints without role fallback (projects, admin GET)", async () => {
    await login(agent, wildcardEmail, pwd);
    // Should allow GET /projects via '*' permission (no HR/management/directors role)
    await agent.get('/projects').expect(200);
    // Should allow admin listings via '*' despite lacking rbac:admin explicitly
    await agent.get('/admin/rbac/roles').expect(200);
    await agent.get('/admin/rbac/permissions').expect(200);
    await agent.post('/auth/logout').expect(200);
  });
});
