CREATE TABLE `taxi_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`doc_no` text NOT NULL,
	`member_id` integer NOT NULL,
	`reason` text NOT NULL,
	`use_start` text NOT NULL,
	`use_end` text NOT NULL,
	`amount` integer NOT NULL,
	`account` text DEFAULT '' NOT NULL,
	`attachment` text DEFAULT '' NOT NULL,
	`retention` integer DEFAULT 3 NOT NULL,
	`written_at` text NOT NULL,
	`team_name` text NOT NULL,
	`position` text NOT NULL,
	`member_name` text NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`decided_by_name` text,
	`decided_at` integer,
	`decision_note` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `taxi_requests_member` ON `taxi_requests` (`member_id`,`written_at`);