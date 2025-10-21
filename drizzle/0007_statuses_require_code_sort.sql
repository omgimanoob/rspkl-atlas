-- Backfill and enforce NOT NULL for project_statuses.code and sort_order
-- This migration ports sql/004_statuses_require_code_sort.sql into the Drizzle flow.

-- Create table if missing (keeps nullable columns so backfill can proceed)
CREATE TABLE IF NOT EXISTS project_statuses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  code VARCHAR(64) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ux_project_statuses_name (name),
  UNIQUE KEY ux_project_statuses_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Backfill code from name where missing/empty
UPDATE project_statuses
SET code = LOWER(REPLACE(TRIM(name), ' ', '-'))
WHERE code IS NULL OR code = '';

-- Backfill sort_order where NULL by assigning incrementing values
SET @max_so := (SELECT COALESCE(MAX(sort_order), 0) FROM project_statuses);
UPDATE project_statuses
SET sort_order = (@max_so := @max_so + 10)
WHERE sort_order IS NULL
ORDER BY id ASC;

-- Enforce NOT NULL constraints
ALTER TABLE project_statuses
  MODIFY COLUMN code VARCHAR(64) NOT NULL,
  MODIFY COLUMN sort_order INT NOT NULL;

