CREATE TABLE `badges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`slug` text NOT NULL,
	`earned_at` integer NOT NULL,
	`seen_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `badges_unique` ON `badges` (`user_id`,`slug`);--> statement-breakpoint
CREATE TABLE `barcode_cache` (
	`barcode` text PRIMARY KEY NOT NULL,
	`food_id` text,
	`not_found` integer DEFAULT false NOT NULL,
	`fetched_at` integer NOT NULL,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `exercise_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`logged_at` integer NOT NULL,
	`local_date` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`intensity` text,
	`duration_min` integer,
	`kcal_burned` real NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `exercise_logs_day` ON `exercise_logs` (`user_id`,`local_date`);--> statement-breakpoint
CREATE TABLE `food_log_items` (
	`id` text PRIMARY KEY NOT NULL,
	`log_id` text NOT NULL,
	`name` text NOT NULL,
	`grams` real NOT NULL,
	`grams_low` real,
	`grams_high` real,
	`kcal_100` real NOT NULL,
	`protein_100` real,
	`carbs_100` real,
	`fat_100` real,
	`fiber_100` real,
	`sugar_100` real,
	`sodium_mg_100` real,
	`is_hidden_fat` integer DEFAULT false NOT NULL,
	`confidence` real,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`log_id`) REFERENCES `food_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `food_log_items_log` ON `food_log_items` (`log_id`);--> statement-breakpoint
CREATE TABLE `food_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`logged_at` integer NOT NULL,
	`local_date` text NOT NULL,
	`meal_slot` text,
	`food_id` text,
	`name` text NOT NULL,
	`brand` text,
	`photo_path` text,
	`quantity` real DEFAULT 1 NOT NULL,
	`portion_label` text DEFAULT 'serving' NOT NULL,
	`grams` real NOT NULL,
	`kcal` real NOT NULL,
	`protein` real DEFAULT 0 NOT NULL,
	`carbs` real DEFAULT 0 NOT NULL,
	`fat` real DEFAULT 0 NOT NULL,
	`fiber` real,
	`sugar` real,
	`sodium_mg` real,
	`health_score` real,
	`ai_confidence` real,
	`kcal_low` real,
	`kcal_high` real,
	`scale_reference` text,
	`assumptions` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `food_logs_day` ON `food_logs` (`user_id`,`local_date`);--> statement-breakpoint
CREATE INDEX `food_logs_recent` ON `food_logs` (`user_id`,`logged_at`);--> statement-breakpoint
CREATE TABLE `food_portions` (
	`id` text PRIMARY KEY NOT NULL,
	`food_id` text NOT NULL,
	`label` text NOT NULL,
	`amount` real DEFAULT 1 NOT NULL,
	`gram_weight` real NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'builtin' NOT NULL,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `food_portions_food` ON `food_portions` (`food_id`);--> statement-breakpoint
CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_id` text,
	`barcode` text,
	`name` text NOT NULL,
	`brand` text,
	`basis` text DEFAULT 'mass' NOT NULL,
	`density_g_per_ml` real,
	`kcal_100` real NOT NULL,
	`protein_100` real,
	`carbs_100` real,
	`fat_100` real,
	`fiber_100` real,
	`sugar_100` real,
	`sat_fat_100` real,
	`sodium_mg_100` real,
	`health_score` real,
	`data_quality` text DEFAULT 'ok' NOT NULL,
	`image_url` text,
	`fetched_at` integer,
	`raw_json` text,
	`owner_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `foods_barcode` ON `foods` (`barcode`);--> statement-breakpoint
CREATE INDEX `foods_name` ON `foods` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `foods_source_unique` ON `foods` (`source`,`source_id`);--> statement-breakpoint
CREATE TABLE `meal_items` (
	`id` text PRIMARY KEY NOT NULL,
	`meal_id` text NOT NULL,
	`food_id` text,
	`name` text NOT NULL,
	`grams` real NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `meal_items_meal` ON `meal_items` (`meal_id`);--> statement-breakpoint
CREATE TABLE `meals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`photo_path` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `nutrition_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`effective_from` text NOT NULL,
	`calories` integer NOT NULL,
	`protein_g` integer NOT NULL,
	`carbs_g` integer NOT NULL,
	`fat_g` integer NOT NULL,
	`source` text DEFAULT 'derived' NOT NULL,
	`bmr` real,
	`tdee` real,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `nutrition_goals_lookup` ON `nutrition_goals` (`user_id`,`effective_from`);--> statement-breakpoint
CREATE TABLE `preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`appearance` text DEFAULT 'system' NOT NULL,
	`badge_celebrations` integer DEFAULT true NOT NULL,
	`add_burned_calories` integer DEFAULT true NOT NULL,
	`rollover_calories` integer DEFAULT true NOT NULL,
	`auto_adjust_macros` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `progress_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`local_date` text NOT NULL,
	`path` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `progress_photos_day` ON `progress_photos` (`user_id`,`local_date`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`slot` text NOT NULL,
	`time_of_day` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reminders_unique` ON `reminders` (`user_id`,`slot`);--> statement-breakpoint
CREATE TABLE `saved_foods` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`food_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_foods_unique` ON `saved_foods` (`user_id`,`food_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text DEFAULT '' NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`username` text DEFAULT '' NOT NULL,
	`avatar_path` text,
	`sex` text DEFAULT 'male' NOT NULL,
	`birth_date` text,
	`height_cm` real,
	`start_weight_kg` real,
	`goal_weight_kg` real,
	`daily_step_goal` integer DEFAULT 10000 NOT NULL,
	`activity_level` text DEFAULT 'sedentary' NOT NULL,
	`weekly_rate_kg` real DEFAULT -0.5 NOT NULL,
	`units` text DEFAULT 'imperial' NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`onboarded_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weight_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`local_date` text NOT NULL,
	`recorded_at` integer NOT NULL,
	`weight_kg` real NOT NULL,
	`photo_path` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weight_entries_day` ON `weight_entries` (`user_id`,`local_date`);