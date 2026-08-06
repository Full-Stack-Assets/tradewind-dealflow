CREATE TABLE `automated_leads` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `source_identity` text NOT NULL,
  `source_record_id` text NOT NULL,
  `source_fingerprint` text NOT NULL,
  `source_retrieved_at` text NOT NULL,
  `provider` text NOT NULL,
  `provider_property_id` text NOT NULL,
  `address` text NOT NULL,
  `city` text NOT NULL,
  `state` text NOT NULL,
  `zip` text NOT NULL,
  `estimated_value` real,
  `owner_names_json` text NOT NULL,
  `owner_type` text,
  `owner_mailing_address_json` text,
  `owner_occupied` integer,
  `enrichment_status` text NOT NULL DEFAULT 'available',
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `automated_leads_org_source_unique` ON `automated_leads` (`organization_id`, `source_identity`, `source_record_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `automated_leads_org_provider_unique` ON `automated_leads` (`organization_id`, `provider`, `provider_property_id`);
--> statement-breakpoint
CREATE INDEX `automated_leads_org_status_idx` ON `automated_leads` (`organization_id`, `enrichment_status`, `updated_at`);
--> statement-breakpoint
CREATE INDEX `automated_leads_org_location_idx` ON `automated_leads` (`organization_id`, `state`, `city`, `zip`);
--> statement-breakpoint
CREATE TABLE `lead_owner_profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `lead_id` text NOT NULL,
  `provider` text NOT NULL,
  `provider_property_id` text NOT NULL,
  `owner_json` text NOT NULL,
  `observed_at` text NOT NULL,
  FOREIGN KEY (`lead_id`) REFERENCES `automated_leads`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_owner_profiles_lead_provider_unique` ON `lead_owner_profiles` (`organization_id`, `lead_id`, `provider`);
--> statement-breakpoint
CREATE TABLE `lead_enrichment_attempts` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `lead_id` text NOT NULL,
  `provider` text NOT NULL,
  `request_hash` text NOT NULL,
  `status` text NOT NULL,
  `response_status` integer,
  `error_code` text,
  `started_at` text NOT NULL,
  `completed_at` text,
  `next_attempt_at` text,
  FOREIGN KEY (`lead_id`) REFERENCES `automated_leads`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_enrichment_attempts_idempotency_unique` ON `lead_enrichment_attempts` (`organization_id`, `lead_id`, `provider`, `request_hash`);
--> statement-breakpoint
CREATE INDEX `lead_enrichment_attempts_retry_idx` ON `lead_enrichment_attempts` (`organization_id`, `status`, `next_attempt_at`);
