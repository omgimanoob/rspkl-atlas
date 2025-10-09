import { TimesheetSync } from '../services/timesheetSync';

export async function syncTimesheetsHandler(_req, res) {
  await TimesheetSync.syncTimesheets();
  res.json({ message: 'Timesheets synced.' });
}
