// index.ts
import express from 'express';
import { getProjectsHandler, getDetailedTimesheetsHandler } from './controllers/projectsController';
import { syncTimesheetsHandler } from './controllers/syncController';
import { getSunburstHandler } from './controllers/biController';
import { updateProjectStatusHandler, updateProjectOverridesHandler } from './controllers/projectOverridesController';
import { authMiddleware, requireRoleUnlessPermitted } from './middleware/auth';
import { requirePermission } from './middleware/permissions';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { atlasPool, kimaiPool } from '../db';
import { loginHandler, logoutHandler, meHandler } from './controllers/authController';
import { AuthService } from './services/authService';


const app = express();
const port = Number(process.env.PORT);
if (!port) {
  throw new Error('PORT environment variable is required');
}

app.use(express.json());
app.use(helmet());
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
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
  requirePermission('overrides:update', { resourceExtractor: (req) => ({ resource_type: 'project', resource_id: req.body?.id ?? req.body?.kimai_project_id }) }),
  requireRoleUnlessPermitted('hr', 'directors'),
  updateProjectStatusHandler
);
app.put(
  '/overrides',
  writeLimiter,
  requirePermission('overrides:update', { resourceExtractor: (req) => ({ resource_type: 'project', resource_id: req.body?.id ?? req.body?.kimai_project_id }) }),
  requireRoleUnlessPermitted('hr', 'directors'),
  updateProjectOverridesHandler
);
app.get('/bi/sunburst', requirePermission('bi:read'), requireRoleUnlessPermitted('hr', 'management', 'directors'), getSunburstHandler);
app.get('/projects', requirePermission('project:read'), requireRoleUnlessPermitted('hr', 'management', 'directors'), getProjectsHandler);
app.get('/timesheets', requirePermission('timesheet:read'), requireRoleUnlessPermitted('hr', 'management', 'directors'), getDetailedTimesheetsHandler);
app.post('/sync/timesheets', writeLimiter, requirePermission('sync:execute'), requireRoleUnlessPermitted('admins'), syncTimesheetsHandler);

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

bootstrap();
