-- Migration: add roles.code and expand roles.name for human-friendly labels

-- 1) Add code column if missing (nullable temporarily)
ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS code VARCHAR(64) NULL;

-- 2) Backfill code from existing name values where NULL
UPDATE roles SET code = name WHERE code IS NULL;

-- 3) Make code NOT NULL
ALTER TABLE roles
  MODIFY COLUMN code VARCHAR(64) NOT NULL;

-- 4) Add unique index on code
ALTER TABLE roles
  ADD UNIQUE INDEX ux_roles_code (code);

-- 5) Expand name column to hold human-friendly labels
ALTER TABLE roles
  MODIFY COLUMN name VARCHAR(128) NOT NULL;

-- 6) Ensure unique index on name exists (optional; ignore errors if exists)
-- ALTER TABLE roles ADD UNIQUE INDEX ux_roles_name (name);

-- 7) Optional: update default display names for known codes
UPDATE roles SET name = 'Administrator' WHERE code = 'admins' AND (name = 'admins' OR name IS NULL);
UPDATE roles SET name = 'Human Resource' WHERE code = 'hr' AND (name = 'hr' OR name IS NULL);
UPDATE roles SET name = 'Management' WHERE code = 'management' AND (name = 'management' OR name IS NULL);
UPDATE roles SET name = 'Directors' WHERE code = 'directors' AND (name = 'directors' OR name IS NULL);

