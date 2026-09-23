-- drizzle-kit dropped "ON DELETE SET NULL" when adding users.member_id via ALTER TABLE.
-- Rebuild the users table with the correct foreign key action.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`member_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
INSERT INTO `__new_users` (`id`, `username`, `name`, `password_hash`, `role`, `member_id`, `created_at`)
SELECT `id`, `username`, `name`, `password_hash`, `role`, `member_id`, `created_at` FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_member_id_unique` ON `users` (`member_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
