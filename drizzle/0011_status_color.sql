-- Add color to project_statuses for UI badges
ALTER TABLE `project_statuses`
  ADD COLUMN `color` varchar(7) NULL AFTER `code`;

