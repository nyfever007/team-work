CREATE TABLE `member_evaluations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`period` text NOT NULL,
	`evaluator_id` integer,
	`evaluator_name` text NOT NULL,
	`scores` text DEFAULT '{}' NOT NULL,
	`total` real,
	`summary` text DEFAULT '' NOT NULL,
	`strengths` text DEFAULT '' NOT NULL,
	`improvements` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`finalized_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`evaluator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_evaluations_member_period` ON `member_evaluations` (`member_id`,`period`);