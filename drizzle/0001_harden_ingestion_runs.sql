-- Preserve the oldest requested active run per policy, using rowid as the
-- deterministic tie-breaker, and retain every duplicate as failed history.
UPDATE `ingestion_runs` AS `duplicate`
SET
	`status` = 'failed',
	`completed_at` = COALESCE(`completed_at`, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`failed_count` = `failed_count` + 1,
	`last_error_code` = 'migration-duplicate-active-run'
WHERE `status` IN ('queued', 'running')
	AND EXISTS (
		SELECT 1
		FROM `ingestion_runs` AS `canonical`
		WHERE `canonical`.`policy_id` = `duplicate`.`policy_id`
			AND `canonical`.`status` IN ('queued', 'running')
			AND (
				`canonical`.`requested_at` < `duplicate`.`requested_at`
				OR (
					`canonical`.`requested_at` = `duplicate`.`requested_at`
					AND `canonical`.`rowid` < `duplicate`.`rowid`
				)
			)
	);--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_runs_one_active_per_policy` ON `ingestion_runs` (`policy_id`) WHERE "ingestion_runs"."status" IN ('queued', 'running');--> statement-breakpoint
CREATE TRIGGER `ingestion_runs_require_active_policy`
BEFORE INSERT ON `ingestion_runs`
WHEN NOT EXISTS (
	SELECT 1 FROM `source_policies`
	WHERE `id` = NEW.`policy_id`
		AND `policy_hash` = NEW.`policy_hash`
		AND `status` = 'active'
)
BEGIN
	SELECT RAISE(ABORT, 'approved policy is no longer active');
END;
