CREATE TABLE `audit_events` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`occurred_at` text NOT NULL,
	`actor_id` text NOT NULL,
	`event_type` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`metadata_json` text NOT NULL,
	`previous_hash` text NOT NULL,
	`event_hash` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_events_id_unique` ON `audit_events` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `audit_events_previous_hash_unique` ON `audit_events` (`previous_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `audit_events_event_hash_unique` ON `audit_events` (`event_hash`);--> statement-breakpoint
CREATE TABLE `ingestion_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`policy_id` text NOT NULL,
	`policy_hash` text NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`requested_at` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	`retrieved_count` integer DEFAULT 0 NOT NULL,
	`safe_count` integer DEFAULT 0 NOT NULL,
	`duplicate_count` integer DEFAULT 0 NOT NULL,
	`changed_count` integer DEFAULT 0 NOT NULL,
	`exception_count` integer DEFAULT 0 NOT NULL,
	`imported_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`last_error_code` text,
	FOREIGN KEY (`policy_id`) REFERENCES `source_policies`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_runs_idempotency_key_unique` ON `ingestion_runs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `ingestion_runs_policy_id_idx` ON `ingestion_runs` (`policy_id`);--> statement-breakpoint
CREATE TABLE `source_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`policy_json` text NOT NULL,
	`policy_hash` text NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`next_run_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_policies_version_unique` ON `source_policies` (`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `source_policies_one_active` ON `source_policies` (`status`) WHERE "source_policies"."status" = 'active';--> statement-breakpoint
CREATE TABLE `source_records` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`source_identity` text NOT NULL,
	`source_record_id` text NOT NULL,
	`retrieved_at` text NOT NULL,
	`raw_json` text NOT NULL,
	`normalized_json` text NOT NULL,
	`raw_fingerprint` text NOT NULL,
	`normalized_fingerprint` text NOT NULL,
	`classification` text NOT NULL,
	`reason_code` text,
	`imported_at` text,
	FOREIGN KEY (`run_id`) REFERENCES `ingestion_runs`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_records_source_normalized_unique` ON `source_records` (`source_identity`,`normalized_fingerprint`);--> statement-breakpoint
CREATE INDEX `source_records_run_id_idx` ON `source_records` (`run_id`);
