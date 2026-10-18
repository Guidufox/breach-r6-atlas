CREATE TABLE `room_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `room_limits_expiry_idx` ON `room_limits` (`expires`);
