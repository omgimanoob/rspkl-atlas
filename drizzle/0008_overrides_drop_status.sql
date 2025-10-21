-- Drop overrides_projects.status column and related index; use status_id only
ALTER TABLE overrides_projects
  DROP INDEX ix_overrides_projects_status;

ALTER TABLE overrides_projects
  DROP COLUMN status;

