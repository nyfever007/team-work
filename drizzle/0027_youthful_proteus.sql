CREATE TABLE `milestone_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`milestone_id` integer NOT NULL,
	`title` text NOT NULL,
	`assignee_id` integer,
	`due_date` text,
	`status` text DEFAULT 'todo' NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`reported_at` integer,
	`approved_at` integer,
	`approved_by_name` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`milestone_id`) REFERENCES `milestones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignee_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `milestone_tasks_milestone` ON `milestone_tasks` (`milestone_id`);--> statement-breakpoint
CREATE INDEX `milestone_tasks_assignee` ON `milestone_tasks` (`assignee_id`);--> statement-breakpoint
ALTER TABLE `daily_tasks` ADD `milestone_task_id` integer;