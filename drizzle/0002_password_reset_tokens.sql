CREATE TABLE `password_reset_tokens` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `token_hash` varchar(128) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `used_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ix_password_reset_user` ON `password_reset_tokens` (`user_id`);

