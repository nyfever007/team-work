CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` integer NOT NULL,
	`post_id` integer,
	`user_id` integer,
	`kind` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`path` text NOT NULL,
	`original_name` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `uploads_post_idx` ON `uploads` (`post_id`);--> statement-breakpoint
CREATE INDEX `uploads_team_idx` ON `uploads` (`team_id`);--> statement-breakpoint
ALTER TABLE `posts` ADD `body_html` text DEFAULT '' NOT NULL;