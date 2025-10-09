// index.ts
import express from 'express';
import { getProjectsHandler, getDetailedTimesheetsHandler } from './controllers/projectsController';
import { syncTimesheetsHandler } from './controllers/syncController';
import { getSunburstHandler } from './controllers/biController';
import { updateProjectStatusHandler } from './controllers/projectOverridesController';
import { authMiddleware, requireRole } from './middleware/auth';
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
app.put('/overrides/status', writeLimiter, requireRole('hr', 'directors'), updateProjectStatusHandler);
app.get('/bi/sunburst', requireRole('hr', 'management', 'directors'), getSunburstHandler);
app.get('/projects', requireRole('hr', 'management', 'directors'), getProjectsHandler);
app.get('/timesheets', requireRole('hr', 'management', 'directors'), getDetailedTimesheetsHandler);
app.post('/sync/timesheets', writeLimiter, requireRole('admins'), syncTimesheetsHandler);

// Error handler (last)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

async function bootstrap() {
  await AuthService.ensureAuthSchema();
  await AuthService.seedAdminIfConfigured();
  app.listen(port, () => {
    console.log(`RSPKL Atlas API listening at http://localhost:${port}`);
  });
}

bootstrap();
