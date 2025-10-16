import { db } from '../db/client';
import { auditLogs } from '../db/schema';

export async function recordAudit(req: any, statusCode: number, payloadHash?: string) {
  try {
    const user = req.user;
    const userId = user?.id ?? null;
    const email = user?.email ?? null;
    const route = req.path || req.originalUrl || '';
    const method = req.method || '';
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || (req.socket && req.socket.remoteAddress) || '';
    await db.insert(auditLogs).values({
      userId: userId ?? null,
      email: email ?? null,
      route,
      method,
      statusCode,
      payloadHash: payloadHash || null,
      ip: String(ip || ''),
    });
  } catch (e) {
    // Non-blocking: do not throw from audit logging
    console.warn('[audit] failed to record audit log', e);
  }
}
