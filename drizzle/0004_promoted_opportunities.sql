CREATE TABLE `promoted_opportunities` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `source_lead_id` text,
  `deal_id` text NOT NULL,
  `deal_json` text NOT NULL,
  `workspace_json` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `promoted_opportunities_org_lead_unique` ON `promoted_opportunities` (`organization_id`, `source_lead_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `promoted_opportunities_org_deal_unique` ON `promoted_opportunities` (`organization_id`, `deal_id`);
--> statement-breakpoint
CREATE INDEX `promoted_opportunities_org_updated_idx` ON `promoted_opportunities` (`organization_id`, `updated_at`);
