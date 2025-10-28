CREATE TABLE `replica_kimai_teams` (
	`id` int NOT NULL,
	`name` varchar(100),
	`color` varchar(7),
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `replica_kimai_teams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `replica_kimai_users_teams` (
	`id` int NOT NULL,
	`user_id` int NOT NULL,
	`team_id` int NOT NULL,
	`teamlead` tinyint NOT NULL DEFAULT 0,
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `replica_kimai_users_teams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studio_directors` (
	`studio_id` bigint unsigned NOT NULL,
	`replica_kimai_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pk_studio_directors` PRIMARY KEY(`studio_id`,`replica_kimai_user_id`)
);
--> statement-breakpoint
CREATE TABLE `studio_teams` (
	`studio_id` bigint unsigned NOT NULL,
	`kimai_team_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pk_studio_teams` PRIMARY KEY(`studio_id`,`kimai_team_id`)
);
--> statement-breakpoint
CREATE TABLE `studios` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studios_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_studios_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE INDEX `ix_replica_users_teams_user` ON `replica_kimai_users_teams` (`user_id`);--> statement-breakpoint
CREATE INDEX `ix_replica_users_teams_team` ON `replica_kimai_users_teams` (`team_id`);--> statement-breakpoint
CREATE INDEX `ix_studio_directors_user` ON `studio_directors` (`replica_kimai_user_id`);--> statement-breakpoint
CREATE INDEX `ix_studio_directors_studio` ON `studio_directors` (`studio_id`);--> statement-breakpoint
CREATE INDEX `ix_studio_teams_team` ON `studio_teams` (`kimai_team_id`);--> statement-breakpoint
CREATE INDEX `ix_studio_teams_studio` ON `studio_teams` (`studio_id`);