CREATE TABLE `replica_kimai_timesheet_meta` (
	`id` int NOT NULL,
	`timesheet_id` int NOT NULL,
	`name` varchar(50) NOT NULL,
	`value` text,
	`visible` tinyint NOT NULL DEFAULT 0,
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `replica_kimai_timesheet_meta_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ix_rktm_timesheet` ON `replica_kimai_timesheet_meta` (`timesheet_id`);--> statement-breakpoint
CREATE INDEX `ix_rktm_name` ON `replica_kimai_timesheet_meta` (`name`);