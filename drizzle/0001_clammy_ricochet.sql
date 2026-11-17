CREATE TABLE `message_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`conversation_id` text,
	`message_id` text,
	`category` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_message_feedback_user_message` ON `message_feedback` (`user_id`,`message_id`);--> statement-breakpoint
CREATE INDEX `idx_message_feedback_created` ON `message_feedback` (`created_at`);--> statement-breakpoint
PRAGMA optimize;
