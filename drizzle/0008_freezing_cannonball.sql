CREATE TABLE IF NOT EXISTS `project_payments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`kimai_project_id` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`notes` text,
	`payment_date` date NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`created_by` bigint unsigned,
	CONSTRAINT `project_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
SET @exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'project_payments'
     AND INDEX_NAME = 'ix_project_payments_kimai'
);
--> statement-breakpoint
SET @stmt := IF(@exists = 0, 'CREATE INDEX `ix_project_payments_kimai` ON `project_payments` (`kimai_project_id`)', 'SELECT 1');
--> statement-breakpoint
PREPARE s FROM @stmt;
--> statement-breakpoint
EXECUTE s;
--> statement-breakpoint
DEALLOCATE PREPARE s;
--> statement-breakpoint
SET @exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'project_payments'
     AND INDEX_NAME = 'ix_project_payments_date'
);
--> statement-breakpoint
SET @stmt := IF(@exists = 0, 'CREATE INDEX `ix_project_payments_date` ON `project_payments` (`payment_date`)', 'SELECT 1');
--> statement-breakpoint
PREPARE s FROM @stmt;
--> statement-breakpoint
EXECUTE s;
--> statement-breakpoint
DEALLOCATE PREPARE s;
