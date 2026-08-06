CREATE TABLE `control_plane_actions` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `action_type` text NOT NULL,
  `target_entity_id` text NOT NULL,
  `requesting_actor_id` text NOT NULL,
  `current_state` text NOT NULL DEFAULT 'DRAFT',
  `current_envelope_hash` text,
  `idempotency_key` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `control_plane_actions_org_idempotency_unique` ON `control_plane_actions` (`organization_id`, `idempotency_key`);
--> statement-breakpoint
CREATE TABLE `control_plane_envelopes` (
  `action_id` text NOT NULL,
  `organization_id` text NOT NULL,
  `envelope_hash` text NOT NULL,
  `envelope_json` text NOT NULL,
  `created_at` text NOT NULL,
  PRIMARY KEY (`action_id`, `envelope_hash`),
  FOREIGN KEY (`action_id`) REFERENCES `control_plane_actions`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `control_plane_approval_requests` (
  `request_id` text PRIMARY KEY NOT NULL,
  `action_id` text NOT NULL,
  `organization_id` text NOT NULL,
  `action_type` text NOT NULL,
  `target_entity_id` text NOT NULL,
  `envelope_hash` text NOT NULL,
  `requirement_json` text NOT NULL,
  `requester_actor_id` text NOT NULL,
  `requested_at` text NOT NULL,
  `expires_at` text,
  `status` text NOT NULL DEFAULT 'PENDING',
  FOREIGN KEY (`action_id`, `envelope_hash`) REFERENCES `control_plane_envelopes`(`action_id`, `envelope_hash`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX `control_plane_approval_requests_org_status_idx` ON `control_plane_approval_requests` (`organization_id`, `status`, `requested_at`);
--> statement-breakpoint
CREATE TABLE `control_plane_approval_decisions` (
  `decision_id` text PRIMARY KEY NOT NULL,
  `request_id` text NOT NULL,
  `organization_id` text NOT NULL,
  `approver_actor_id` text NOT NULL,
  `approver_role` text NOT NULL,
  `decision` text NOT NULL,
  `envelope_hash` text NOT NULL,
  `comments` text,
  `decided_at` text NOT NULL,
  UNIQUE (`request_id`, `approver_actor_id`),
  FOREIGN KEY (`request_id`) REFERENCES `control_plane_approval_requests`(`request_id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `control_plane_authorities` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `actor_id` text NOT NULL,
  `role` text NOT NULL,
  `scope` text NOT NULL,
  `active_from` text NOT NULL,
  `active_until` text,
  `revoked` integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX `control_plane_authorities_lookup_idx` ON `control_plane_authorities` (`organization_id`, `actor_id`, `role`, `scope`);
--> statement-breakpoint
CREATE TABLE `control_plane_ledger_events` (
  `sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `event_id` text NOT NULL UNIQUE,
  `occurred_at` text NOT NULL,
  `actor_id` text NOT NULL,
  `event_type` text NOT NULL,
  `aggregate_type` text NOT NULL,
  `aggregate_id` text NOT NULL,
  `payload_json` text NOT NULL,
  `previous_hash` text,
  `event_hash` text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE `control_plane_webhook_events` (
  `event_id` text PRIMARY KEY NOT NULL,
  `provider` text NOT NULL,
  `event_type` text NOT NULL,
  `payload_json` text NOT NULL,
  `received_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `control_plane_idempotency_claims` (
  `idempotency_key` text PRIMARY KEY NOT NULL,
  `operation` text NOT NULL,
  `status` text NOT NULL,
  `created_at` text NOT NULL,
  `completed_at` text
);
