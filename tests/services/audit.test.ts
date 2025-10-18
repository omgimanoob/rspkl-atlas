import { db } from '../../src/db/client';
import { auditLogs } from '../../src/db/schema';
import { recordAudit } from '../../src/services/audit';
import { eq } from 'drizzle-orm';

describe('recordAudit (DB)', () => {
  it('inserts an audit log row', async () => {
    const uniqueRoute = `/ut-audit-${Date.now()}`;
    const req: any = {
      user: { id: 123, email: 'audit.ut@example.com' },
      path: uniqueRoute,
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    await recordAudit(req, 201, 'abc123');
    const rows = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.route, uniqueRoute));
    expect(rows.length).toBeGreaterThan(0);
  });
});

