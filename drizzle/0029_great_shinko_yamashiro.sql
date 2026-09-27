CREATE TABLE `growth_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`quarter` text NOT NULL,
	`title` text NOT NULL,
	`plan` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`reflection` text DEFAULT '' NOT NULL,
	`leader_comment` text DEFAULT '' NOT NULL,
	`leader_name` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `growth_goals_member_idx` ON `growth_goals` (`member_id`,`quarter`);--> statement-breakpoint
CREATE TABLE `onboarding_checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `onboarding_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_checks_unique` ON `onboarding_checks` (`item_id`,`member_id`);--> statement-breakpoint
CREATE TABLE `onboarding_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`post_id` integer,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `onboarding_items_team_idx` ON `onboarding_items` (`team_id`);--> statement-breakpoint
CREATE TABLE `one_on_one_actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`meeting_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	`title` text NOT NULL,
	`owner` text DEFAULT 'member' NOT NULL,
	`done_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `one_on_ones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `one_on_one_actions_member_idx` ON `one_on_one_actions` (`member_id`);--> statement-breakpoint
CREATE TABLE `one_on_ones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`date` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`agenda` text DEFAULT '' NOT NULL,
	`member_agenda` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`private_notes` text DEFAULT '' NOT NULL,
	`leader_user_id` integer,
	`leader_name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`leader_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `one_on_ones_member_idx` ON `one_on_ones` (`member_id`,`date`);--> statement-breakpoint
CREATE TABLE `post_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`body` text NOT NULL,
	`author_user_id` integer,
	`author_member_id` integer,
	`author_name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`author_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `post_comments_post_idx` ON `post_comments` (`post_id`);--> statement-breakpoint
CREATE TABLE `post_reactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_reactions_unique` ON `post_reactions` (`post_id`,`member_id`,`kind`);--> statement-breakpoint
CREATE INDEX `post_reactions_member_idx` ON `post_reactions` (`member_id`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`prompt` text DEFAULT '' NOT NULL,
	`prompt_use` text DEFAULT '' NOT NULL,
	`prompt_model` text DEFAULT '' NOT NULL,
	`decision_status` text,
	`decided_at` text,
	`accepted_comment_id` integer,
	`pinned` integer DEFAULT false NOT NULL,
	`author_user_id` integer,
	`author_member_id` integer,
	`author_name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`author_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `posts_team_idx` ON `posts` (`team_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `posts_author_idx` ON `posts` (`author_member_id`);--> statement-breakpoint
CREATE TABLE `pulse_responses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	`week_start` text NOT NULL,
	`workload` integer NOT NULL,
	`mood` integer NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pulse_member_week` ON `pulse_responses` (`member_id`,`week_start`);--> statement-breakpoint
CREATE INDEX `pulse_team_week` ON `pulse_responses` (`team_id`,`week_start`);--> statement-breakpoint
CREATE TABLE `retro_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`retro_id` integer NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`author_member_id` integer,
	`author_name` text NOT NULL,
	`owner_member_id` integer,
	`done_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`retro_id`) REFERENCES `retros`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`owner_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `retro_items_retro_idx` ON `retro_items` (`retro_id`);--> statement-breakpoint
CREATE TABLE `retro_votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `retro_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `retro_votes_unique` ON `retro_votes` (`item_id`,`member_id`);--> statement-breakpoint
CREATE TABLE `retros` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`title` text NOT NULL,
	`milestone_id` integer,
	`anonymous` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`model` text,
	`created_by` integer,
	`created_by_name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`milestone_id`) REFERENCES `milestones`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `retros_team_idx` ON `retros` (`team_id`);