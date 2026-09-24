CREATE TABLE `dinner_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`stage` text NOT NULL,
	`parent_id` integer,
	`doc_no` text NOT NULL,
	`member_id` integer NOT NULL,
	`headcount` text NOT NULL,
	`limit_per_person` integer NOT NULL,
	`amount` integer NOT NULL,
	`pay_method` text NOT NULL,
	`dinner_date` text,
	`account` text DEFAULT '' NOT NULL,
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
	FOREIGN KEY (`parent_id`) REFERENCES `dinner_requests`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `dinner_requests_member` ON `dinner_requests` (`member_id`,`written_at`);--> statement-breakpoint
CREATE INDEX `dinner_requests_parent` ON `dinner_requests` (`parent_id`);