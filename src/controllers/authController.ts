import { config } from '../config';
import { AuthService } from '../services/authService';
import { db } from '../db/client';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

function setCookie(res, name: string, value: string, maxAgeSeconds: number) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export async function loginHandler(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  const user = await AuthService.findUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await AuthService.verifyPassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const roles = await AuthService.getUserRoles(user.id);
  const token = AuthService.signJwt({ id: user.id, email: user.email, roles });
  setCookie(res, config.auth.cookieName, token, config.auth.tokenTtlSeconds);
  return res.json({ email: user.email, roles });
}

export async function logoutHandler(_req, res) {
  // Expire cookie
  setCookie(res, config.auth.cookieName, '', 0);
  res.json({ ok: true });
}

export async function meHandler(req, res) {
  const u = (req as any).user;
  if (!u) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const row = await db.select().from(users).where(eq(users.id, u.id)).limit(1).then(r => r[0]);
    const display_name = row?.displayName ?? null;
    res.json({ ...u, display_name });
  } catch {
    // Fallback to auth payload if DB lookup fails
    res.json(u);
  }
}
