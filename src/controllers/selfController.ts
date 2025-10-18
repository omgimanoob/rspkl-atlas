import { requireAuth } from '../middleware/auth';
import { UsersService } from '../services/usersService';
import { AuthService } from '../services/authService';
import rateLimit from 'express-rate-limit';
import { recordAudit } from '../services/audit';
import { incPasswordChange, incPasswordResetConfirm, incPasswordResetRequest } from '../services/metrics';

export const selfWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 100 : 30,
  keyGenerator: (req) => {
    const hdr = (req.headers && (req.headers['x-rl-key'] as any)) || '';
    const val = Array.isArray(hdr) ? hdr[0] : hdr;
    return String(val || req.ip);
  },
});

export async function updateMeHandler(req, res) {
  const u = (req as any).user;
  if (!u) return res.status(401).json({ error: 'Unauthorized' });
  const { display_name } = req.body || {};
  if (display_name !== undefined && typeof display_name !== 'string') {
    return res.status(400).json({ error: 'Bad Request', reason: 'invalid_display_name' });
  }
  const updated = await UsersService.updateUser(u.id, { displayName: display_name ?? undefined });
  if (!updated) return res.status(404).json({ error: 'Not Found' });
  return res.json(updated);
}

export async function changePasswordHandler(req, res) {
  const u = (req as any).user;
  if (!u) return res.status(401).json({ error: 'Unauthorized' });
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) return res.status(400).json({ error: 'Bad Request', reason: 'invalid_input' });
  try {
    await AuthService.changePassword(u.id, String(current_password), String(new_password));
    incPasswordChange(true);
    await recordAudit(req, 200);
    return res.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || 'error';
    if (msg === 'invalid_current_password') { incPasswordChange(false); return res.status(400).json({ error: 'Bad Request', reason: 'invalid_current_password' }); }
    if (msg === 'weak_password') { incPasswordChange(false); return res.status(400).json({ error: 'Bad Request', reason: 'weak_password' }); }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function requestPasswordResetHandler(req, res) {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Bad Request', reason: 'invalid_email' });
  const resp = await AuthService.requestPasswordReset(email);
  incPasswordResetRequest();
  // Always 200, do not disclose existence; include debug token only in test.
  return res.json(resp);
}

export async function confirmPasswordResetHandler(req, res) {
  const { token, new_password } = req.body || {};
  if (!token || !new_password) return res.status(400).json({ error: 'Bad Request', reason: 'invalid_input' });
  try {
    await AuthService.confirmPasswordReset(String(token), String(new_password));
    incPasswordResetConfirm(true);
    await recordAudit(req, 200);
    return res.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || 'error';
    const bad = ['invalid_input', 'weak_password', 'invalid_token', 'token_used', 'token_expired'];
    if (bad.includes(msg)) { incPasswordResetConfirm(false); return res.status(400).json({ error: 'Bad Request', reason: msg }); }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
