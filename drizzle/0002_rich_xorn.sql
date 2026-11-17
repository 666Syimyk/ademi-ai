ALTER TABLE `users` ADD `profile_completed_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_r2_key` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_mime_type` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_size_bytes` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_updated_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_avatar_r2_key` ON `users` (`avatar_r2_key`);