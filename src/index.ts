// index.ts
import express from 'express';
import { getProjectsHandler, getDetailedTimesheetsHandler } from './controllers/projectsController';
import { syncTimesheetsHandler } from './controllers/syncController';
import { getSunburstHandler } from './controllers/biController';
import { updateProjectStatusHandler, updateProjectOverridesHandler } from './controllers/projectOverridesController';
import { authMiddleware } from './middleware/auth';
import { requirePermission, enforceIfEnabled, permit } from './middleware/permissions';
import {
  listRoles,
  createRole,
  deleteRole,
  listPermissions,
  createPermission,
  deletePermission,
  addPermissionToRole,
  removePermissionFromRole,
  assignRoleToUser,
  removeRoleFromUser,
  listGrants,
  createGrant,
  deleteGrant,
} from './controllers/rbacController';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { atlasPool, kimaiPool } from '../db';
import { loginHandler, logoutHandler, meHandler } from './controllers/authController';
import { AuthService } from './services/authService';


export const app = express();
const port = Number(process.env.PORT);
if (!port) {
  throw new Error('PORT environment variable is required');
}

app.use(express.json());
app.use(helmet());
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'test' ? 10000 : 10 });
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60 });
app.use(authMiddleware);

// Public auth endpoints
app.post('/auth/login', loginLimiter, loginHandler);
app.post('/auth/logout', logoutHandler);
app.get('/me', meHandler);

// Health endpoint
app.get('/healthz', async (_req, res) => {
  try {
    await Promise.all([
      atlasPool.query('SELECT 1'),
      kimaiPool.query('SELECT 1'),
    ]);
    res.json({ ok: true, db: true });
  } catch (e) {
    res.status(500).json({ ok: false, db: false });
  }
});

// Static public assets (login page can be added later)
app.use(express.static('public'));

// API routes with RBAC
// Dual-gate: permissions OR legacy roles
app.put(
  '/overrides/status',
  writeLimiter,
  ...permit('overrides:update', 'write', { resourceExtractor: (req) => ({ resource_type: 'project', resource_id: req.body?.id ?? req.body?.kimai_project_id }) }),
  updateProjectStatusHandler
);
app.put(
  '/overrides',
  writeLimiter,
  ...permit('overrides:update', 'write', { resourceExtractor: (req) => ({ resource_type: 'project', resource_id: req.body?.id ?? req.body?.kimai_project_id }) }),
  updateProjectOverridesHandler
);
app.get('/bi/sunburst', ...permit('bi:read', 'read'), getSunburstHandler);
app.get('/projects', ...permit('project:read', 'read'), getProjectsHandler);
app.get('/timesheets', ...permit('timesheet:read', 'read'), getDetailedTimesheetsHandler);
app.post('/sync/timesheets', writeLimiter, ...permit('sync:execute', 'write'), syncTimesheetsHandler);

// Admin RBAC APIs (strict permission-only)
app.get('/admin/rbac/roles', ...permit('rbac:admin', 'read'), listRoles);
app.post('/admin/rbac/roles', writeLimiter, ...permit('rbac:admin', 'write'), createRole);
app.delete('/admin/rbac/roles/:id', writeLimiter, ...permit('rbac:admin', 'write'), deleteRole);

app.get('/admin/rbac/permissions', ...permit('rbac:admin', 'read'), listPermissions);
app.post('/admin/rbac/permissions', writeLimiter, ...permit('rbac:admin', 'write'), createPermission);
app.delete('/admin/rbac/permissions/:id', writeLimiter, ...permit('rbac:admin', 'write'), deletePermission);

app.post('/admin/rbac/roles/:id/permissions/:perm', writeLimiter, ...permit('rbac:admin', 'write'), addPermissionToRole);
app.delete('/admin/rbac/roles/:id/permissions/:perm', writeLimiter, ...permit('rbac:admin', 'write'), removePermissionFromRole);

app.post('/admin/rbac/users/:id/roles/:role', writeLimiter, ...permit('rbac:admin', 'write'), assignRoleToUser);
app.delete('/admin/rbac/users/:id/roles/:role', writeLimiter, ...permit('rbac:admin', 'write'), removeRoleFromUser);

app.get('/admin/rbac/grants', ...permit('rbac:admin', 'read'), listGrants);
app.post('/admin/rbac/grants', writeLimiter, ...permit('rbac:admin', 'write'), createGrant);
app.delete('/admin/rbac/grants/:id', writeLimiter, ...permit('rbac:admin', 'write'), deleteGrant);

// Minimal metrics endpoint (no auth; safe aggregate counters only)
import { metricsSnapshot } from './services/metrics';
app.get('/metrics', (_req, res) => {
  res.json(metricsSnapshot());
});

// Error handler (last)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

async function bootstrap() {
  await AuthService.seedAdminIfConfigured();
  app.listen(port, () => {
    console.log(`RSPKL Atlas API listening at http://localhost:${port}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}
