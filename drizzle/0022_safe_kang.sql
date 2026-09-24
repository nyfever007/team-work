CREATE TABLE `overtime_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`doc_no` text NOT NULL,
	`member_id` integer NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`hours` real NOT NULL,
	`reason` text NOT NULL,
	`written_at` text NOT NULL,
	`team_name` text NOT NULL,
	`position` text NOT NULL,
	`duty` text NOT NULL,
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
CREATE INDEX `overtime_requests_member` ON `overtime_requests` (`member_id`,`start_at`);