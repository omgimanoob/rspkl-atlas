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
  AND kimai2_projects.id NOT IN(92,93,94,95,140,141,142,145,157)  
  AND kimai2_customers.id NOT IN (43, 84, 85, 86)
  AND kimai2_users.id NOT IN (155, 156, 157, 158, 168, 169, 170, 173)
ORDER BY
  customer_name ASC,
  project_name ASC,
  activity_name ASC,
  staff_member ASC,
  kimai2_timesheet.start_time ASC,cncbd_desc ASC;
