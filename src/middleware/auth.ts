import { config } from '../config';
import { AuthService } from '../services/authService';

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

// Role gates have been replaced by permission gates. This file retains only auth parsing helpers.
