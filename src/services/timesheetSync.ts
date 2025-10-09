import { kimaiPool, atlasPool } from '../../db';
import { RowDataPacket } from 'mysql2';

export class TimesheetSync {
  static async syncTimesheets() {
    const [rows] = await kimaiPool.query<RowDataPacket[]>(`
      SELECT DISTINCT
        kimai2_timesheet.id AS timesheet_id,
        kimai2_timesheet.start_time,
        kimai2_timesheet.end_time,
        kimai2_timesheet.duration,
        kimai2_timesheet.description,
        kimai2_timesheet.rate,
        kimai2_timesheet.fixed_rate,
        kimai2_timesheet.hourly_rate,
        kimai2_timesheet.billable,
        kimai2_timesheet.category,
        kimai2_timesheet.user AS staff_member_id,
        kimai2_customers.id AS customer_id,
        kimai2_customers.name AS customer_name,
        kimai2_projects.id AS project_id,
        kimai2_projects.name AS project_name,
        kimai2_activities.id AS activity_id,
        kimai2_activities.name AS activity_name,
        kimai2_users.username AS staff_member,
        kimai2_timesheet_meta.value AS cncbd,
        CASE kimai2_timesheet_meta.value
          WHEN 'C' THEN 'Chargeable'
          WHEN 'NC' THEN 'Non-Chargeable'
          WHEN 'BD' THEN 'Business Dev / Buddings / Proposal'
          ELSE 'Unknown'
        END AS cncbd_desc
      FROM
        kimai2_timesheet
        JOIN kimai2_projects ON kimai2_timesheet.project_id = kimai2_projects.id
        JOIN kimai2_customers ON kimai2_projects.customer_id = kimai2_customers.id
        JOIN kimai2_activities ON kimai2_timesheet.activity_id = kimai2_activities.id
        JOIN kimai2_users ON kimai2_timesheet.user = kimai2_users.id
        JOIN kimai2_timesheet_meta ON kimai2_timesheet.id = kimai2_timesheet_meta.timesheet_id
      WHERE
        kimai2_timesheet.duration IS NOT NULL
        AND kimai2_timesheet_meta.name="cncbd"
    `);

    console.log(`Fetched ${rows.length} rows from Kimai.`);

    for (const row of rows) {
      await atlasPool.query(
        `INSERT INTO timesheet_snapshots 
          (timesheet_id, start_time, end_time, duration, description, rate, fixed_rate, hourly_rate, billable, category,
          staff_member_id, customer_id, customer_name, project_id, project_name, activity_id, activity_name,
          staff_member, cncbd, cncbd_desc)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE 
          start_time=VALUES(start_time),
          end_time=VALUES(end_time),
          duration=VALUES(duration),
          description=VALUES(description),
          rate=VALUES(rate),
          fixed_rate=VALUES(fixed_rate),
          hourly_rate=VALUES(hourly_rate),
          billable=VALUES(billable),
          category=VALUES(category),
          staff_member_id=VALUES(staff_member_id),
          customer_id=VALUES(customer_id),
          customer_name=VALUES(customer_name),
          project_id=VALUES(project_id),
          project_name=VALUES(project_name),
          activity_id=VALUES(activity_id),
          activity_name=VALUES(activity_name),
          staff_member=VALUES(staff_member),
          cncbd=VALUES(cncbd),
          cncbd_desc=VALUES(cncbd_desc)
        `,
        [
          row.timesheet_id, row.start_time, row.end_time, row.duration, row.description,
          row.rate, row.fixed_rate, row.hourly_rate, row.billable, row.category,
          row.staff_member_id, row.customer_id, row.customer_name,
          row.project_id, row.project_name, row.activity_id, row.activity_name,
          row.staff_member, row.cncbd, row.cncbd_desc
        ]
      );
    }

    console.log(`Inserted/updated ${rows.length} rows in local timesheet_snapshots.`);
  }
}
