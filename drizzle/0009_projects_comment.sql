-- Add comment column to Kimai projects replica for richer search
ALTER TABLE `replica_kimai_projects`
  ADD COLUMN `comment` text NULL;

