import { atlasPool } from '../../db';

export async function recordAudit(req: any, statusCode: number, payloadHash?: string) {
  try {
    const user = req.user;
    const userId = user?.id ?? null;
    const email = user?.email ?? null;
    const route = req.path || req.originalUrl || '';
    const method = req.method || '';
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || (req.socket && req.socket.remoteAddress) || '';
    await atlasPool.query(
      'INSERT INTO audit_logs (user_id, email, route, method, status_code, payload_hash, ip) VALUES (?,?,?,?,?,?,?)',
      [userId, email, route, method, statusCode, payloadHash || null, ip as string]
    );
  } catch (e) {
    // Non-blocking: do not throw from audit logging
    console.warn('[audit] failed to record audit log', e);
  }
}

