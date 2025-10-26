-- Add color to project_statuses for UI badges (idempotent)
SET @exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'project_statuses'
     AND COLUMN_NAME = 'color'
);
--> statement-breakpoint
SET @stmt := IF(@exists = 0, 'ALTER TABLE `project_statuses` ADD COLUMN `color` varchar(7) NULL AFTER `code`', 'SELECT 1');
--> statement-breakpoint
PREPARE s FROM @stmt;
--> statement-breakpoint
EXECUTE s;
--> statement-breakpoint
DEALLOCATE PREPARE s;
