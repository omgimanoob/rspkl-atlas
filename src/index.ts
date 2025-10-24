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
  listRolePermissions,
  listUserRoles,
} from './controllers/rbacController';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { atlasPool, kimaiPool } from '../db';
import { loginHandler, logoutHandler, meHandler } from './controllers/authController';
import { AuthService } from './services/authService';
import { updateMeHandler, changePasswordHandler, requestPasswordResetHandler, confirmPasswordResetHandler, selfWriteLimiter } from './controllers/selfController';
import { syncProjectsHandler } from './controllers/syncController';
import { syncHealthHandler } from './controllers/syncHealthController';
import { createProspectiveHandler, listProspectiveHandler, linkProspectiveHandler } from './controllers/prospectiveProjectsController';
import { listStatusesHandler, createStatusHandler, updateStatusHandler, deleteStatusHandler } from './controllers/statusesController';
import {
  listProjectsV2Handler,
  createProspectiveV2Handler,
  updateProspectiveV2Handler,
  linkProspectiveV2Handler,
  updateKimaiOverridesV2Handler,
} from './controllers/projectsV2Controller';
import {
  createUserHandler,
  listUsersHandler,
  getUserByIdHandler,
  updateUserHandler,
  activateUserHandler,
  deactivateUserHandler,
  deleteUserHandler,
} from './controllers/usersController';


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
app.put('/me', selfWriteLimiter, updateMeHandler);
app.post('/me/password', selfWriteLimiter, changePasswordHandler);
app.post('/auth/password-reset/request', selfWriteLimiter, requestPasswordResetHandler);
app.post('/auth/password-reset/confirm', selfWriteLimiter, confirmPasswordResetHandler);

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
app.post('/sync/projects', writeLimiter, ...permit('sync:execute', 'write'), syncProjectsHandler);
app.get('/sync/health', ...permit('sync:execute', 'read'), syncHealthHandler);

// Public statuses lookup for UI (read-only)
app.get('/statuses', ...permit('project:read', 'read'), listStatusesHandler);

// Prospective projects creation (non-admin; permission-gated)
app.post('/prospective', writeLimiter, ...permit('prospective:create', 'write'), createProspectiveHandler);

// Prospective projects listing (non-admin read)
app.get('/prospective', ...permit('prospective:read', 'read'), listProspectiveHandler);

// Prospective projects (admin-only for now)
app.post('/admin/prospective', writeLimiter, ...permit('rbac:admin', 'write'), createProspectiveHandler);
app.get('/admin/prospective', ...permit('rbac:admin', 'read'), listProspectiveHandler);
app.post('/admin/prospective/:id/link', writeLimiter, ...permit('rbac:admin', 'write'), linkProspectiveHandler);

// Admin RBAC APIs (strict permission-only)
app.get('/admin/rbac/roles', ...permit('rbac:admin', 'read'), listRoles);
app.post('/admin/rbac/roles', writeLimiter, ...permit('rbac:admin', 'write'), createRole);
app.delete('/admin/rbac/roles/:id', writeLimiter, ...permit('rbac:admin', 'write'), deleteRole);

app.get('/admin/rbac/permissions', ...permit('rbac:admin', 'read'), listPermissions);
app.post('/admin/rbac/permissions', writeLimiter, ...permit('rbac:admin', 'write'), createPermission);
app.delete('/admin/rbac/permissions/:id', writeLimiter, ...permit('rbac:admin', 'write'), deletePermission);

app.post('/admin/rbac/roles/:id/permissions/:perm', writeLimiter, ...permit('rbac:admin', 'write'), addPermissionToRole);
app.delete('/admin/rbac/roles/:id/permissions/:perm', writeLimiter, ...permit('rbac:admin', 'write'), removePermissionFromRole);
app.get('/admin/rbac/roles/:id/permissions', ...permit('rbac:admin', 'read'), listRolePermissions);

app.post('/admin/rbac/users/:id/roles/:role', writeLimiter, ...permit('rbac:admin', 'write'), assignRoleToUser);
app.delete('/admin/rbac/users/:id/roles/:role', writeLimiter, ...permit('rbac:admin', 'write'), removeRoleFromUser);
app.get('/admin/rbac/users/:id/roles', ...permit('rbac:admin', 'read'), listUserRoles);

app.get('/admin/rbac/grants', ...permit('rbac:admin', 'read'), listGrants);
app.post('/admin/rbac/grants', writeLimiter, ...permit('rbac:admin', 'write'), createGrant);
app.delete('/admin/rbac/grants/:id', writeLimiter, ...permit('rbac:admin', 'write'), deleteGrant);

// Admin Project Statuses (lookup table)
app.get('/admin/statuses', ...permit('rbac:admin', 'read'), listStatusesHandler);
app.post('/admin/statuses', writeLimiter, ...permit('rbac:admin', 'write'), createStatusHandler);
app.put('/admin/statuses/:id', writeLimiter, ...permit('rbac:admin', 'write'), updateStatusHandler);
app.delete('/admin/statuses/:id', writeLimiter, ...permit('rbac:admin', 'write'), deleteStatusHandler);

// Admin Users APIs (permission-only)
app.post('/admin/users', writeLimiter, ...permit('rbac:admin', 'write'), createUserHandler);
app.get('/admin/users', ...permit('rbac:admin', 'read'), listUsersHandler);
app.get('/admin/users/:id', ...permit('rbac:admin', 'read'), getUserByIdHandler);
app.put('/admin/users/:id', writeLimiter, ...permit('rbac:admin', 'write'), updateUserHandler);
app.post('/admin/users/:id/activate', writeLimiter, ...permit('rbac:admin', 'write'), activateUserHandler);
app.post('/admin/users/:id/deactivate', writeLimiter, ...permit('rbac:admin', 'write'), deactivateUserHandler);
app.delete('/admin/users/:id', writeLimiter, ...permit('rbac:admin', 'write'), deleteUserHandler);

// V2 Projects APIs
app.get('/v2/projects', ...permit('project:read', 'read'), listProjectsV2Handler);
app.get('/v2/statuses', ...permit('project:read', 'read'), listStatusesHandler);
app.post('/v2/prospective', writeLimiter, ...permit('prospective:create', 'write'), createProspectiveV2Handler);
app.put('/v2/prospective/:id', writeLimiter, ...permit('prospective:update', 'write'), updateProspectiveV2Handler);
app.post('/v2/prospective/:id/link', writeLimiter, ...permit('prospective:link', 'write'), linkProspectiveV2Handler);
app.put('/v2/projects/:kimaiId/overrides', writeLimiter, ...permit('overrides:update', 'write', { resourceExtractor: (req) => ({ resource_type: 'project', resource_id: Number(req.params.kimaiId) || null }) }), updateKimaiOverridesV2Handler);

// Minimal metrics endpoint (no auth; safe aggregate counters only)
import { metricsSnapshot, syncMetrics } from './services/metrics';
app.get('/metrics', async (_req, res) => {
  try {
    const base = metricsSnapshot();
    const sync = await syncMetrics();
    res.json({ ...base, sync });
  } catch (e: any) {
    // Fall back to base metrics if sync query fails
    res.json(metricsSnapshot());
  }
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
