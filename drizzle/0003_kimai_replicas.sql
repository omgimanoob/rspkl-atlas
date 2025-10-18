CREATE TABLE IF NOT EXISTS `replica_kimai_projects` (
  `id` int NOT NULL,
  `customer_id` int,
  `name` varchar(150),
  `visible` tinyint(1),
  `budget` varchar(64),
  `color` varchar(7),
  `time_budget` int,
  `order_date` datetime,
  `start` datetime,
  `end` datetime,
  `timezone` varchar(64),
  `budget_type` varchar(10),
  `billable` tinyint(1),
  `synced_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`)
);
CREATE INDEX `ix_replica_proj_customer` ON `replica_kimai_projects` (`customer_id`);

CREATE TABLE IF NOT EXISTS `replica_kimai_timesheets` (
  `id` int NOT NULL,
  `user` int,
  `activity_id` int,
  `project_id` int,
  `start_time` datetime NOT NULL,
  `end_time` datetime,
  `duration` int,
  `description` varchar(191),
  `rate` varchar(64),
  `fixed_rate` varchar(64),
  `hourly_rate` varchar(64),
  `exported` tinyint(1),
  `timezone` varchar(64),
  `internal_rate` varchar(64),
  `billable` tinyint(1),
  `category` varchar(10),
  `modified_at` datetime,
  `date_tz` varchar(16),
  `synced_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`)
);
CREATE INDEX `ix_replica_ts_project` ON `replica_kimai_timesheets` (`project_id`);
CREATE INDEX `ix_replica_ts_user` ON `replica_kimai_timesheets` (`user`);
CREATE INDEX `ix_replica_ts_activity` ON `replica_kimai_timesheets` (`activity_id`);
CREATE INDEX `ix_replica_ts_date` ON `replica_kimai_timesheets` (`date_tz`);
CREATE INDEX `ix_replica_ts_modified` ON `replica_kimai_timesheets` (`modified_at`);

CREATE TABLE IF NOT EXISTS `sync_state` (
  `state_key` varchar(64) NOT NULL,
  `state_value` varchar(191),
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`state_key`)
);

