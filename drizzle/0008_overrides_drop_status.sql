-- Drop project_overrides.status column and related index; use status_id only
ALTER TABLE project_overrides
  DROP INDEX ix_project_overrides_status;

ALTER TABLE project_overrides
  DROP COLUMN status;

