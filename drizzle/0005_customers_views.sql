CREATE TABLE IF NOT EXISTS `replica_kimai_customers` (
  `id` int NOT NULL,
  `name` varchar(191),
  `visible` tinyint(1),
  `timezone` varchar(64),
  `currency` varchar(8),
  `synced_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`)
);

-- Views for analytics
DROP VIEW IF EXISTS `vw_projects`;
CREATE VIEW `vw_projects` AS
SELECT
  p.*, 
  o.money_collected AS override_money_collected,
  o.status AS override_status,
  o.is_prospective AS override_is_prospective
FROM `replica_kimai_projects` p
LEFT JOIN `project_overrides` o ON o.kimai_project_id = p.id;

DROP VIEW IF EXISTS `vw_timesheet_facts`;
CREATE VIEW `vw_timesheet_facts` AS
SELECT
  t.*, 
  p.name AS project_name,
  p.customer_id,
  u.username AS user_name,
  a.name AS activity_name,
  vp.override_status AS project_status,
  vp.override_is_prospective AS project_is_prospective,
  (
    SELECT GROUP_CONCAT(tt.name ORDER BY tt.name SEPARATOR ',')
    FROM `replica_kimai_timesheet_tags` ts
    JOIN `replica_kimai_tags` tt ON tt.id = ts.tag_id
    WHERE ts.timesheet_id = t.id
  ) AS timesheet_tags
FROM `replica_kimai_timesheets` t
JOIN `replica_kimai_projects` p ON p.id = t.project_id
LEFT JOIN `replica_kimai_users` u ON u.id = t.user
LEFT JOIN `replica_kimai_activities` a ON a.id = t.activity_id
LEFT JOIN `vw_projects` vp ON vp.id = t.project_id;

