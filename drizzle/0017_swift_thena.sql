CREATE TABLE `member_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`week_start` text NOT NULL,
	`reviewer_id` integer,
	`reviewer_name` text NOT NULL,
	`rating` integer,
	`summary` text DEFAULT '' NOT NULL,
	`strengths` text DEFAULT '' NOT NULL,
	`improvements` text DEFAULT '' NOT NULL,
	`next_actions` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`model` text,
	`generated_at` integer,
	`shared_at` integer,
	`ack_at` integer,
	`reply` text DEFAULT '' NOT NULL,
	`replied_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_reviews_member_week` ON `member_reviews` (`member_id`,`week_start`);