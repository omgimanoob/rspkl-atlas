CREATE TABLE IF NOT EXISTS `overrides_projects` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `kimai_project_id` bigint unsigned NULL,
  `money_collected` decimal(12,2) NULL,
  `status` varchar(32) NULL,
  `is_prospective` tinyint(1) NULL,
  `notes` varchar(1024) NULL,
  `source` varchar(64) NULL,
  `updated_by_user_id` bigint unsigned NULL,
  `updated_by_email` varchar(255) NULL,
  `extras_json` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
CREATE UNIQUE INDEX `ux_overrides_projects_kimai_project` ON `overrides_projects` (`kimai_project_id`);
CREATE INDEX `ix_overrides_projects_status` ON `overrides_projects` (`status`);
CREATE INDEX `ix_overrides_projects_prospective` ON `overrides_projects` (`is_prospective`);

