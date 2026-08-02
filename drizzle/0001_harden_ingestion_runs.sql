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
