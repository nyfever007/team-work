-- Promote free-text member.team / milestone.team into a teams table.
-- Uses ADD/DROP COLUMN only (no table rebuild) so no cascading deletes can happen.
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`leader_member_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`leader_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE UNIQUE INDEX `teams_name_unique` ON `teams` (`name`);--> statement-breakpoint
INSERT INTO `teams` (`name`) SELECT DISTINCT `team` FROM `members` WHERE `team` <> '' ORDER BY `team`;--> statement-breakpoint
INSERT OR IGNORE INTO `teams` (`name`) SELECT DISTINCT `team` FROM `milestones` WHERE `team` <> '';--> statement-breakpoint
ALTER TABLE `members` ADD `team_id` integer REFERENCES teams(id);--> statement-breakpoint
UPDATE `members` SET `team_id` = (SELECT `id` FROM `teams` WHERE `teams`.`name` = `members`.`team`);--> statement-breakpoint
UPDATE `teams` SET `leader_member_id` = (SELECT `id` FROM `members` WHERE `members`.`team_id` = `teams`.`id` AND `members`.`is_leader` = 1 ORDER BY `id` LIMIT 1);--> statement-breakpoint
ALTER TABLE `members` DROP COLUMN `team`;--> statement-breakpoint
ALTER TABLE `members` DROP COLUMN `is_leader`;--> statement-breakpoint
CREATE INDEX `members_team_idx` ON `members` (`team_id`);--> statement-breakpoint
ALTER TABLE `milestones` ADD `team_id` integer REFERENCES teams(id);--> statement-breakpoint
UPDATE `milestones` SET `team_id` = (SELECT `id` FROM `teams` WHERE `teams`.`name` = `milestones`.`team`);--> statement-breakpoint
ALTER TABLE `milestones` DROP COLUMN `team`;
