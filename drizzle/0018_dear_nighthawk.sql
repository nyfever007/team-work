ALTER TABLE `milestones` ADD `approval` text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE `milestones` ADD `approval_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `milestones` ADD `approval_by_name` text;--> statement-breakpoint
ALTER TABLE `milestones` ADD `approval_at` integer;