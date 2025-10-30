// index.ts
import express from 'express';
import { getProjectsHandler, getDetailedTimesheetsHandler } from './controllers/projectsController';
import { syncTimesheetsHandler, clearReplicaHandler, syncUsersHandler, syncActivitiesHandler, syncTagsHandler, syncCustomersHandler, syncTimesheetMetaHandler, syncTeamsHandler, syncUsersTeamsHandler } from './controllers/syncController';
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
import { syncHealthHandler, syncVerifyHandler } from './controllers/syncHealthController';
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
import { listPaymentsHandler, createPaymentHandler, recalcPaymentTotalsHandler } from './controllers/paymentsController';
import {
  listStudiosHandler,
  createStudioHandler,
  updateStudioHandler,
  deleteStudioHandler,
  listReplicaTeamsHandler,
  listStudioTeamsHandler,
  addStudioTeamHandler,
  removeStudioTeamHandler,
  listReplicaUsersHandler,
  listStudioDirectorsHandler,
  addStudioDirectorHandler,
  removeStudioDirectorHandler,
} from './controllers/studiosController'


export const app = express();
// Behind Cloudflare -> Nginx -> Node, trust two proxies to get real client IP
// This also satisfies express-rate-limit when X-Forwarded-For is present
app.set('trust proxy', 2);
const port = Number(process.env.PORT);
if (!port) {
  throw new Error('PORT environment variable is required');
}

app.use(express.json());
app.use(helmet());
const isDev = process.env.NODE_ENV !== 'production';
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : (process.env.NODE_ENV === 'test' ? 10000 : 10),
  standardHeaders: true,
  legacyHeaders: false,
});
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
});
const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 2000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(authMiddleware);

// Public auth endpoints
app.post('/api/auth/login', loginLimiter, loginHandler);
app.post('/api/auth/logout', logoutHandler);
app.get('/api/me', meHandler);
app.put('/api/me', selfWriteLimiter, updateMeHandler);
app.post('/api/me/password', selfWriteLimiter, changePasswordHandler);
app.post('/api/auth/password-reset/request', selfWriteLimiter, requestPasswordResetHandler);
app.post('/api/auth/password-reset/confirm', selfWriteLimiter, confirmPasswordResetHandler);

// Health endpoint
app.get('/api/healthz', async (_req, res) => {
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

// Static assets and built client app
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  // Serve built client first so '/' serves the app
  app.use(express.static(path.resolve(process.cwd(), 'client', 'dist')));
  // Serve public assets without claiming '/'
  app.use(express.static('public', { index: false } as any));
} else {
  // Dev: only serve public assets; Vite serves the client
  app.use(express.static('public'));
}

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
app.get('/api/bi/sunburst', ...permit('bi:read', 'read'), getSunburstHandler);
app.get('/api/projects', ...permit('project:read', 'read'), getProjectsHandler);
app.get('/api/timesheets', ...permit('timesheet:read', 'read'), getDetailedTimesheetsHandler);
app.post('/api/sync/timesheets', syncLimiter, ...permit('sync:execute', 'write'), syncTimesheetsHandler);
app.post('/api/sync/users', syncLimiter, ...permit('sync:execute', 'write'), syncUsersHandler);
app.post('/api/sync/activities', syncLimiter, ...permit('sync:execute', 'write'), syncActivitiesHandler);
app.post('/api/sync/tags', syncLimiter, ...permit('sync:execute', 'write'), syncTagsHandler);
app.post('/api/sync/customers', syncLimiter, ...permit('sync:execute', 'write'), syncCustomersHandler);
app.post('/api/sync/tsmeta', syncLimiter, ...permit('sync:execute', 'write'), syncTimesheetMetaHandler);
app.post('/api/sync/teams', syncLimiter, ...permit('sync:execute', 'write'), syncTeamsHandler);
app.post('/api/sync/teams-users', syncLimiter, ...permit('sync:execute', 'write'), syncUsersTeamsHandler);
app.post('/api/sync/clear/:table', syncLimiter, ...permit('sync:execute', 'write'), clearReplicaHandler);
app.post('/api/sync/projects', syncLimiter, ...permit('sync:execute', 'write'), syncProjectsHandler);
app.get('/api/sync/health', ...permit('sync:execute', 'read'), syncHealthHandler);
app.get('/api/sync/verify', ...permit('sync:execute', 'read'), syncVerifyHandler);

// Public statuses lookup for UI (read-only)
app.get('/api/statuses', ...permit('project:read', 'read'), listStatusesHandler);

// Prospective projects creation (non-admin; permission-gated)
app.post('/api/prospective', writeLimiter, ...permit('prospective:create', 'write'), createProspectiveHandler);

// Prospective projects listing (non-admin read)
app.get('/api/prospective', ...permit('prospective:read', 'read'), listProspectiveHandler);

// Prospective projects (admin-only for now)
app.post('/api/admin/prospective', writeLimiter, ...permit('rbac:admin', 'write'), createProspectiveHandler);
app.get('/api/admin/prospective', ...permit('rbac:admin', 'read'), listProspectiveHandler);
app.post('/api/admin/prospective/:id/link', writeLimiter, ...permit('rbac:admin', 'write'), linkProspectiveHandler);

// Admin RBAC APIs (strict permission-only)
app.get('/api/admin/rbac/roles', ...permit('rbac:admin', 'read'), listRoles);
app.post('/api/admin/rbac/roles', writeLimiter, ...permit('rbac:admin', 'write'), createRole);
app.delete('/api/admin/rbac/roles/:id', writeLimiter, ...permit('rbac:admin', 'write'), deleteRole);

app.get('/api/admin/rbac/permissions', ...permit('rbac:admin', 'read'), listPermissions);
app.post('/api/admin/rbac/permissions', writeLimiter, ...permit('rbac:admin', 'write'), createPermission);
app.delete('/api/admin/rbac/permissions/:id', writeLimiter, ...permit('rbac:admin', 'write'), deletePermission);

app.post('/api/admin/rbac/roles/:id/permissions/:perm', writeLimiter, ...permit('rbac:admin', 'write'), addPermissionToRole);
app.delete('/api/admin/rbac/roles/:id/permissions/:perm', writeLimiter, ...permit('rbac:admin', 'write'), removePermissionFromRole);
app.get('/api/admin/rbac/roles/:id/permissions', ...permit('rbac:admin', 'read'), listRolePermissions);

app.post('/api/admin/rbac/users/:id/roles/:role', writeLimiter, ...permit('rbac:admin', 'write'), assignRoleToUser);
app.delete('/api/admin/rbac/users/:id/roles/:role', writeLimiter, ...permit('rbac:admin', 'write'), removeRoleFromUser);
app.get('/api/admin/rbac/users/:id/roles', ...permit('rbac:admin', 'read'), listUserRoles);

app.get('/api/admin/rbac/grants', ...permit('rbac:admin', 'read'), listGrants);
app.post('/api/admin/rbac/grants', writeLimiter, ...permit('rbac:admin', 'write'), createGrant);
app.delete('/api/admin/rbac/grants/:id', writeLimiter, ...permit('rbac:admin', 'write'), deleteGrant);

// Admin Project Statuses (lookup table)
app.get('/api/admin/statuses', ...permit('rbac:admin', 'read'), listStatusesHandler);
app.post('/api/admin/statuses', writeLimiter, ...permit('rbac:admin', 'write'), createStatusHandler);
app.put('/api/admin/statuses/:id', writeLimiter, ...permit('rbac:admin', 'write'), updateStatusHandler);
app.delete('/api/admin/statuses/:id', writeLimiter, ...permit('rbac:admin', 'write'), deleteStatusHandler);

// Admin Users APIs (permission-only)
app.post('/api/admin/users', writeLimiter, ...permit('rbac:admin', 'write'), createUserHandler);
app.get('/api/admin/users', ...permit('rbac:admin', 'read'), listUsersHandler);
app.get('/api/admin/users/:id', ...permit('rbac:admin', 'read'), getUserByIdHandler);
app.put('/api/admin/users/:id', writeLimiter, ...permit('rbac:admin', 'write'), updateUserHandler);
app.post('/api/admin/users/:id/activate', writeLimiter, ...permit('rbac:admin', 'write'), activateUserHandler);
app.post('/api/admin/users/:id/deactivate', writeLimiter, ...permit('rbac:admin', 'write'), deactivateUserHandler);
app.delete('/api/admin/users/:id', writeLimiter, ...permit('rbac:admin', 'write'), deleteUserHandler);

// V2 Projects APIs
app.get('/api/v2/projects', ...permit('project:read', 'read'), listProjectsV2Handler);
app.get('/api/v2/statuses', ...permit('project:read', 'read'), listStatusesHandler);
app.post('/api/v2/prospective', writeLimiter, ...permit('prospective:create', 'write'), createProspectiveV2Handler);
app.put('/api/v2/prospective/:id', writeLimiter, ...permit('prospective:update', 'write'), updateProspectiveV2Handler);
app.post('/api/v2/prospective/:id/link', writeLimiter, ...permit('prospective:link', 'write'), linkProspectiveV2Handler);
app.put('/api/v2/projects/:kimaiId/overrides', writeLimiter, ...permit('overrides:update', 'write', { resourceExtractor: (req) => ({ resource_type: 'project', resource_id: Number(req.params.kimaiId) || null }) }), updateKimaiOverridesV2Handler);

// Payments
app.get('/api/payments', ...permit('payments:view', 'read'), listPaymentsHandler);
app.post('/api/payments', writeLimiter, ...permit('payments:create', 'write'), createPaymentHandler);
app.post('/api/payments/recalc/:kimaiId', writeLimiter, ...permit('payments:create', 'write'), recalcPaymentTotalsHandler);

// Studios (admin-only for now)
app.get('/api/studios', ...permit('rbac:admin', 'read'), listStudiosHandler)
app.post('/api/studios', writeLimiter, ...permit('rbac:admin', 'write'), createStudioHandler)
app.put('/api/studios/:id', writeLimiter, ...permit('rbac:admin', 'write'), updateStudioHandler)
app.delete('/api/studios/:id', writeLimiter, ...permit('rbac:admin', 'write'), deleteStudioHandler)
app.get('/api/teams', ...permit('rbac:admin', 'read'), listReplicaTeamsHandler)
app.get('/api/studios/:id/teams', ...permit('rbac:admin', 'read'), listStudioTeamsHandler)
app.post('/api/studios/:id/teams', writeLimiter, ...permit('rbac:admin', 'write'), addStudioTeamHandler)
app.delete('/api/studios/:id/teams/:teamId', writeLimiter, ...permit('rbac:admin', 'write'), removeStudioTeamHandler)
app.get('/api/kimai-users', ...permit('rbac:admin', 'read'), listReplicaUsersHandler)
app.get('/api/studios/:id/directors', ...permit('rbac:admin', 'read'), listStudioDirectorsHandler)
app.post('/api/studios/:id/directors', writeLimiter, ...permit('rbac:admin', 'write'), addStudioDirectorHandler)
app.delete('/api/studios/:id/directors/:userId', writeLimiter, ...permit('rbac:admin', 'write'), removeStudioDirectorHandler)

// Minimal metrics endpoint (no auth; safe aggregate counters only)
import { metricsSnapshot, syncMetrics } from './services/metrics';
app.get('/api/metrics', async (_req, res) => {
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

// SPA fallback (middleware) for non-API GETs in production
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.originalUrl.startsWith('/api/')) return next();
    if (/\.[a-zA-Z0-9]+$/.test(req.originalUrl)) return next();
    res.sendFile(path.resolve(process.cwd(), 'client', 'dist', 'index.html'));
  });
}

async function bootstrap() {
  try {
    await AuthService.seedAdminIfConfigured();
  } catch (e: any) {
    console.warn('[bootstrap] Admin seed skipped:', e?.message || e);
  }
  app.listen(port, () => {
    console.log(`RSPKL Atlas API listening at http://localhost:${port}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}
