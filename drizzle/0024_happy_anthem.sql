ALTER TABLE `general_requests` ADD `period` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `general_requests` ADD `timing` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `general_requests` ADD `currency` text DEFAULT 'KRW' NOT NULL;--> statement-breakpoint
-- 기간/시기 become free text: carry existing dates over before dropping the old columns.
UPDATE `general_requests` SET `period` = CASE WHEN `period_start` IS NULL THEN '' WHEN `period_end` IS NULL OR `period_end` = `period_start` THEN `period_start` ELSE `period_start` || ' ~ ' || `period_end` END, `timing` = coalesce(`pay_date`, '');--> statement-breakpoint
ALTER TABLE `general_requests` DROP COLUMN `period_start`;--> statement-breakpoint
ALTER TABLE `general_requests` DROP COLUMN `period_end`;--> statement-breakpoint
ALTER TABLE `general_requests` DROP COLUMN `pay_date`;