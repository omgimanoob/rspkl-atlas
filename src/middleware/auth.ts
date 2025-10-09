import { config } from '../config';
import { AuthService, AuthUser } from '../services/authService';

function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(';');
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    const v = decodeURIComponent(p.slice(idx + 1).trim());
    out[k] = v;
  }
  return out;
}

export function authMiddleware(req, _res, next) {
  const cookies = parseCookies(req.headers?.cookie);
  const token = cookies[config.auth.cookieName];
  if (token) {
    const user = AuthService.verifyJwt(token);
    if (user) {
      (req as any).user = user;
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!(req as any).user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

export function requireRole(...allowed: string[]) {
  return (req, res, next) => {
    const user: AuthUser | undefined = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    // Admins bypass role checks
    if (user.roles?.includes('admins')) return next();
    const has = user.roles?.some(r => allowed.includes(r));
    if (!has) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}
