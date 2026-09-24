ALTER TABLE `member_evaluations` ADD `reasons` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `member_evaluations` ADD `ai_model` text;--> statement-breakpoint
ALTER TABLE `member_evaluations` ADD `ai_generated_at` integer;