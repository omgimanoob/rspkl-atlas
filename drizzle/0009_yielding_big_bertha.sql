CREATE TABLE IF NOT EXISTS `project_statuses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`code` varchar(64) NOT NULL,
	`color` varchar(7),
	`is_active` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_statuses_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_project_statuses_name` UNIQUE(`name`),
	CONSTRAINT `ux_project_statuses_code` UNIQUE(`code`)
);
