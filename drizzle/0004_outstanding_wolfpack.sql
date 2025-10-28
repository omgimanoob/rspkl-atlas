ALTER TABLE `roles` MODIFY COLUMN `name` varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE `project_overrides` ADD `status_id` int;--> statement-breakpoint
ALTER TABLE `roles` ADD `code` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `roles` ADD CONSTRAINT `ux_roles_code` UNIQUE(`code`);