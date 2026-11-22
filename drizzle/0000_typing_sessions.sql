CREATE TABLE `typing_sessions` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`saved_at` integer NOT NULL,
	`phase` text NOT NULL,
	`kind` text NOT NULL,
	`target` integer NOT NULL,
	`profile` text NOT NULL,
	`punctuation` integer NOT NULL,
	`caps` integer NOT NULL,
	`elapsed_ms` integer NOT NULL,
	`correct_chars` integer NOT NULL,
	`hits` integer NOT NULL,
	`attempts` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `typing_sessions_user_time` ON `typing_sessions` (`user_id`,`saved_at`);