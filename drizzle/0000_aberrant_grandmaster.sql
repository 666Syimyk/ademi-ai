CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_by` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`request_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_events_created` ON `audit_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_events_actor_created` ON `audit_events` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_events_entity_created` ON `audit_events` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text DEFAULT 'New conversation' NOT NULL,
	`language` text DEFAULT 'RU' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_message_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_conversations_user_status_last` ON `conversations` (`user_id`,`status`,`last_message_at`);--> statement-breakpoint
CREATE TABLE `crisis_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`conversation_id` text,
	`message_id` text,
	`severity` text NOT NULL,
	`category` text NOT NULL,
	`action` text NOT NULL,
	`locale` text NOT NULL,
	`message_fingerprint` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_crisis_events_created` ON `crisis_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `material_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`material_id` text NOT NULL,
	`version_no` integer NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`raw_r2_key` text NOT NULL,
	`extracted_r2_key` text,
	`extraction_status` text DEFAULT 'stored' NOT NULL,
	`error_message` text,
	`openai_file_id` text,
	`openai_vector_file_id` text,
	`indexed_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_material_versions_number` ON `material_versions` (`material_id`,`version_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_material_versions_r2_key` ON `material_versions` (`raw_r2_key`);--> statement-breakpoint
CREATE INDEX `idx_material_versions_status` ON `material_versions` (`extraction_status`);--> statement-breakpoint
CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'course' NOT NULL,
	`language` text DEFAULT 'RU' NOT NULL,
	`visibility` text DEFAULT 'owner' NOT NULL,
	`lifecycle` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`current_version_id` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_materials_slug` ON `materials` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_materials_visibility_lifecycle` ON `materials` (`visibility`,`lifecycle`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`provider` text,
	`provider_customer_id` text,
	`provider_subscription_id` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`granted_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`granted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_memberships_user_status_end` ON `memberships` (`user_id`,`status`,`ends_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_memberships_provider_subscription` ON `memberships` (`provider`,`provider_subscription_id`);--> statement-breakpoint
CREATE TABLE `message_sources` (
	`message_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`material_id` text,
	`version_id` text,
	`file_id` text,
	`label` text NOT NULL,
	`locator_json` text DEFAULT '{}' NOT NULL,
	PRIMARY KEY(`message_id`, `ordinal`),
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`version_id`) REFERENCES `material_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'complete' NOT NULL,
	`language` text NOT NULL,
	`safety_level` text DEFAULT 'standard' NOT NULL,
	`model` text,
	`provider_response_id` text,
	`client_request_id` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_messages_request_id` ON `messages` (`conversation_id`,`client_request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_messages_conversation_ordinal` ON `messages` (`conversation_id`,`ordinal`);--> statement-breakpoint
CREATE INDEX `idx_messages_conversation_created` ON `messages` (`conversation_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `payment_webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`external_event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`processing_status` text DEFAULT 'received' NOT NULL,
	`received_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`processed_at` integer,
	`error_code` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_webhook_provider_event` ON `payment_webhook_events` (`provider`,`external_event_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`plan_id` text,
	`provider` text NOT NULL,
	`external_payment_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text DEFAULT 'KGS' NOT NULL,
	`status` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_payments_provider_external` ON `payments` (`provider`,`external_payment_id`);--> statement-breakpoint
CREATE INDEX `idx_payments_user_created` ON `payments` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`price_minor` integer NOT NULL,
	`currency` text DEFAULT 'KGS' NOT NULL,
	`duration_days` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_plans_code` ON `plans` (`code`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`user_id` text NOT NULL,
	`scope` text NOT NULL,
	`window_started_at` integer NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `scope`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_user_id` text,
	`email` text NOT NULL,
	`full_name` text,
	`role` text DEFAULT 'student' NOT NULL,
	`account_status` text DEFAULT 'active' NOT NULL,
	`preferred_language` text DEFAULT 'RU' NOT NULL,
	`history_enabled` integer DEFAULT false NOT NULL,
	`consent_version` text,
	`consent_at` integer,
	`last_seen_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_auth_user_id` ON `users` (`auth_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_role_status` ON `users` (`role`,`account_status`);--> statement-breakpoint
PRAGMA optimize;
