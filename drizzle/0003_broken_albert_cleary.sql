CREATE TABLE `project_overrides` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`kimai_project_id` bigint unsigned,
	`money_collected` varchar(64),
	`status` varchar(32),
	`is_prospective` tinyint,
	`notes` varchar(1024),
	`source` varchar(64),
	`updated_by_user_id` bigint unsigned,
	`updated_by_email` varchar(255),
	`extras_json` varchar(2048),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_overrides_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_project_overrides_kimai_project` UNIQUE(`kimai_project_id`)
);
--> statement-breakpoint
CREATE TABLE `replica_kimai_customers` (
	`id` int NOT NULL,
	`name` varchar(191),
	`visible` tinyint,
	`timezone` varchar(64),
	`currency` varchar(8),
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `replica_kimai_customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ix_project_overrides_status` ON `project_overrides` (`status`);--> statement-breakpoint
CREATE INDEX `ix_project_overrides_prospective` ON `project_overrides` (`is_prospective`);