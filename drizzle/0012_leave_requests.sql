CREATE TABLE `leave_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`doc_no` text NOT NULL,
	`member_id` integer NOT NULL,
	`type` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`days` real NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`delegate` text DEFAULT '' NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`written_at` text NOT NULL,
	`team_name` text NOT NULL,
	`position` text NOT NULL,
	`member_name` text NOT NULL,
	`used_days` real NOT NULL,
	`total_days` real NOT NULL,
	`remaining_days` real NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `leave_requests_member` ON `leave_requests` (`member_id`,`start_date`);--> statement-breakpoint
ALTER TABLE `leaves` ADD `request_id` integer REFERENCES leave_requests(id);