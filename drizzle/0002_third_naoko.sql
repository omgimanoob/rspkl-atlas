CREATE TABLE `replica_kimai_activities` (
	`id` int NOT NULL,
	`project_id` int,
	`name` varchar(150),
	`visible` tinyint,
	`billable` tinyint,
	`time_budget` int,
	`budget` varchar(64),
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `replica_kimai_activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `replica_kimai_projects` (
	`id` int NOT NULL,
	`customer_id` int,
	`name` varchar(150),
	`visible` tinyint,
	`budget` varchar(64),
	`color` varchar(7),
	`time_budget` int,
	`order_date` timestamp,
	`start` timestamp,
	`end` timestamp,
	`timezone` varchar(64),
	`budget_type` varchar(10),
	`billable` tinyint,
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `replica_kimai_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `replica_kimai_tags` (
	`id` int NOT NULL,
	`name` varchar(191),
	`color` varchar(7),
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `replica_kimai_tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `replica_kimai_timesheet_tags` (
	`timesheet_id` int NOT NULL,
	`tag_id` int NOT NULL,
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pk_replica_ts_tags` PRIMARY KEY(`timesheet_id`,`tag_id`)
);
--> statement-breakpoint
CREATE TABLE `replica_kimai_timesheets` (
	`id` int NOT NULL,
	`user` int,
	`activity_id` int,
	`project_id` int,
	`start_time` timestamp NOT NULL,
	`end_time` timestamp,
	`duration` int,
	`description` varchar(191),
	`rate` varchar(64),
	`fixed_rate` varchar(64),
	`hourly_rate` varchar(64),
	`exported` tinyint,
	`timezone` varchar(64),
	`internal_rate` varchar(64),
	`billable` tinyint,
	`category` varchar(10),
	`modified_at` timestamp,
	`date_tz` varchar(16),
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `replica_kimai_timesheets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `replica_kimai_users` (
	`id` int NOT NULL,
	`username` varchar(191),
	`email` varchar(191),
	`enabled` tinyint,
	`color` varchar(7),
	`account` varchar(30),
	`system_account` tinyint,
	`supervisor_id` int,
	`timezone` varchar(64),
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `replica_kimai_users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`state_key` varchar(64) NOT NULL,
	`state_value` varchar(191),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sync_state_state_key` PRIMARY KEY(`state_key`)
);
--> statement-breakpoint
CREATE INDEX `ix_replica_act_project` ON `replica_kimai_activities` (`project_id`);--> statement-breakpoint
CREATE INDEX `ix_replica_proj_customer` ON `replica_kimai_projects` (`customer_id`);--> statement-breakpoint
CREATE INDEX `ix_replica_ts_project` ON `replica_kimai_timesheets` (`project_id`);--> statement-breakpoint
CREATE INDEX `ix_replica_ts_user` ON `replica_kimai_timesheets` (`user`);--> statement-breakpoint
CREATE INDEX `ix_replica_ts_activity` ON `replica_kimai_timesheets` (`activity_id`);--> statement-breakpoint
CREATE INDEX `ix_replica_ts_date` ON `replica_kimai_timesheets` (`date_tz`);--> statement-breakpoint
CREATE INDEX `ix_replica_ts_modified` ON `replica_kimai_timesheets` (`modified_at`);--> statement-breakpoint
CREATE INDEX `ix_replica_users_enabled` ON `replica_kimai_users` (`enabled`);
