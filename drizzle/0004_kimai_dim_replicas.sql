CREATE TABLE IF NOT EXISTS `replica_kimai_users` (
  `id` int NOT NULL,
  `username` varchar(191),
  `email` varchar(191),
  `enabled` tinyint(1),
  `color` varchar(7),
  `account` varchar(30),
  `system_account` tinyint(1),
  `supervisor_id` int,
  `timezone` varchar(64),
  `synced_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`)
);
CREATE INDEX `ix_replica_users_enabled` ON `replica_kimai_users` (`enabled`);

CREATE TABLE IF NOT EXISTS `replica_kimai_activities` (
  `id` int NOT NULL,
  `project_id` int,
  `name` varchar(150),
  `visible` tinyint(1),
  `billable` tinyint(1),
  `time_budget` int,
  `budget` varchar(64),
  `synced_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`)
);
CREATE INDEX `ix_replica_act_project` ON `replica_kimai_activities` (`project_id`);

CREATE TABLE IF NOT EXISTS `replica_kimai_tags` (
  `id` int NOT NULL,
  `name` varchar(191),
  `color` varchar(7),
  `synced_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `replica_kimai_timesheet_tags` (
  `timesheet_id` int NOT NULL,
  `tag_id` int NOT NULL,
  `synced_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(`timesheet_id`,`tag_id`)
);

