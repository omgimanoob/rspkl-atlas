CREATE TABLE `audit_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned,
	`email` varchar(255),
	`route` varchar(255) NOT NULL,
	`method` varchar(16) NOT NULL,
	`status_code` int,
	`payload_hash` varchar(128),
	`ip` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
