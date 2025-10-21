-- Backfill missing code and sort_order, then enforce NOT NULL

-- 1) Ensure table exists (noop if present)
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

-- 2) Backfill code where NULL/empty using a simple slug of name
UPDATE project_statuses
SET code = LOWER(REPLACE(TRIM(name), ' ', '-'))
WHERE code IS NULL OR code = '';

-- 3) Backfill sort_order where NULL by assigning incrementing values
SET @max_so := (SELECT COALESCE(MAX(sort_order), 0) FROM project_statuses);
UPDATE project_statuses
SET sort_order = (@max_so := @max_so + 10)
WHERE sort_order IS NULL
ORDER BY id ASC;

-- 4) Enforce NOT NULL constraints
ALTER TABLE project_statuses
  MODIFY COLUMN code VARCHAR(64) NOT NULL,
  MODIFY COLUMN sort_order INT NOT NULL;

