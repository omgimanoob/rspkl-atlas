-- Replica table for Kimai timesheet meta
CREATE TABLE IF NOT EXISTS `replica_kimai_timesheet_meta` (
  `id` int NOT NULL,
  `timesheet_id` int NOT NULL,
  `name` varchar(50) NOT NULL,
  `value` text,
  `visible` tinyint(1) NOT NULL DEFAULT 0,
  `synced_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  INDEX `ix_rktm_timesheet` (`timesheet_id`),
  INDEX `ix_rktm_name` (`name`)
);

