CREATE TABLE `sound_tags` (
	`sound_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`sound_id`, `tag_id`),
	FOREIGN KEY (`sound_id`) REFERENCES `sounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sound_tags_tag_id_idx` ON `sound_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `sounds` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`checksum` text NOT NULL,
	`extension` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`duration_ms` integer,
	`original_filename` text NOT NULL,
	`hotkey` text,
	`position` integer NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sounds_checksum_unique` ON `sounds` (`checksum`);--> statement-breakpoint
CREATE UNIQUE INDEX `sounds_hotkey_unique` ON `sounds` (`hotkey`);--> statement-breakpoint
CREATE INDEX `sounds_position_idx` ON `sounds` (`position`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`issuer` text NOT NULL,
	`subject` text NOT NULL,
	`email` text,
	`name` text,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_issuer_subject_unique` ON `users` (`issuer`,`subject`);