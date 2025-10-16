CREATE TABLE `permission_grants` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`subject_type` varchar(16) NOT NULL,
	`subject_id` bigint unsigned NOT NULL,
	`permission` varchar(64) NOT NULL,
	`resource_type` varchar(32),
	`resource_id` bigint unsigned,
	`constraints_json` varchar(1024),
	`expires_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `permission_grants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_permissions_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `rbac_audit_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned,
	`permission` varchar(64) NOT NULL,
	`resource_type` varchar(32),
	`resource_id` bigint unsigned,
	`decision` varchar(16) NOT NULL,
	`reason` varchar(128),
	`route` varchar(255),
	`method` varchar(16),
	`ip` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rbac_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` int NOT NULL,
	`permission_id` int NOT NULL,
	CONSTRAINT `pk_role_permissions` PRIMARY KEY(`role_id`,`permission_id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(32) NOT NULL,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_roles_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `user_permissions` (
	`user_id` bigint unsigned NOT NULL,
	`permission_id` int NOT NULL,
	CONSTRAINT `pk_user_permissions` PRIMARY KEY(`user_id`,`permission_id`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` bigint unsigned NOT NULL,
	`role_id` int NOT NULL,
	CONSTRAINT `pk_user_roles` PRIMARY KEY(`user_id`,`role_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`display_name` varchar(255),
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_users_email` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `ix_grants_subject` ON `permission_grants` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE INDEX `ix_grants_permission` ON `permission_grants` (`permission`);