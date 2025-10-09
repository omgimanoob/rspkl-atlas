import { TimesheetSync } from '../services/timesheetSync';
import crypto from 'crypto';
import { recordAudit } from '../services/audit';

export async function syncTimesheetsHandler(_req, res) {
  await TimesheetSync.syncTimesheets();
  await recordAudit(_req as any, 200, crypto.createHash('sha256').update('syncTimesheets').digest('hex'));
  res.json({ message: 'Timesheets synced.' });
}
