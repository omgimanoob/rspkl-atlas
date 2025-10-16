import { db } from '../db/client';
import { auditLogs, rbacAuditLogs } from '../db/schema';

let auditWarnCount = 0;

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
  } catch (e: any) {
    // Non-blocking: keep logs concise and rate-limited
    if (auditWarnCount < 3) {
      const code = e?.cause?.code || e?.code || 'ERR';
      const msg = e?.cause?.sqlMessage || e?.message || '';
      console.warn(`[audit] write failed: ${code}${msg ? ` - ${msg}` : ''}`);
      auditWarnCount++;
    }
  }
}

export async function recordRbacAdmin(req: any, action: string, resourceType?: string, resourceId?: number) {
  try {
    const user = req.user;
    const userId = user?.id ?? null;
    const route = req.path || req.originalUrl || '';
    const method = req.method || '';
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || (req.socket && req.socket.remoteAddress) || '';
    await db.insert(rbacAuditLogs).values({
      userId: userId ?? null,
      permission: 'rbac:admin',
      resourceType: resourceType || null,
      resourceId: resourceId ?? null,
      decision: 'mutate',
      reason: action.slice(0, 120),
      route,
      method,
      ip: String(ip || ''),
    });
  } catch (e: any) {
    if (auditWarnCount < 3) {
      const code = e?.cause?.code || e?.code || 'ERR';
      const msg = e?.cause?.sqlMessage || e?.message || '';
      console.warn(`[audit] rbac write failed: ${code}${msg ? ` - ${msg}` : ''}`);
      auditWarnCount++;
    }
  }
}
