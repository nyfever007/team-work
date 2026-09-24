ALTER TABLE `leave_requests` ADD `decided_by_name` text;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD `decided_at` integer;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD `decision_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Before approvals existed, every submitted request was already on the calendar: treat them as approved.
UPDATE `leave_requests` SET `status` = 'approved' WHERE `status` = 'submitted';
