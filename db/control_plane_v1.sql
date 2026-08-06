-- ============================================================================
-- Tradewind DealFlow Control Plane v1 — Zero-Trust PostgreSQL Schema
-- File: db/control_plane_v1.sql
-- ============================================================================
-- Reference-only PostgreSQL design. The deployed Worker runtime uses the
-- D1/SQLite migration at drizzle/0002_control_plane.sql; this file is not
-- applied by the Worker.

-- 1. Custom Domains and Types
CREATE DOMAIN sha256_hash AS TEXT
  CHECK (VALUE ~ '^sha256:[a-f0-9]{64}$');

CREATE TYPE execution_state_enum AS ENUM (
  'DRAFT',
  'POLICY_EVALUATION',
  'REVIEW_REQUIRED',
  'APPROVED',
  'READY',
  'EXECUTING',
  'EXECUTED',
  'RECEIPTED',
  'DENIED',
  'INVALIDATED',
  'EXPIRED',
  'CANCELLED',
  'FAILED'
);

CREATE TYPE policy_decision_enum AS ENUM ('ALLOW', 'DENY', 'REVIEW_REQUIRED');

CREATE TYPE approval_state_enum AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'INVALIDATED'
);

CREATE TYPE attempt_status_enum AS ENUM (
  'STARTED',
  'SUCCESS',
  'FAILED',
  'EXECUTION_OUTCOME_UNKNOWN'
);

-- 2. State Transition Legal Matrix Table
CREATE TABLE allowed_action_state_transitions (
  from_state execution_state_enum NOT NULL,
  to_state execution_state_enum NOT NULL,
  PRIMARY KEY (from_state, to_state)
);

INSERT INTO allowed_action_state_transitions (from_state, to_state) VALUES
  ('DRAFT', 'POLICY_EVALUATION'),
  ('DRAFT', 'CANCELLED'),
  ('POLICY_EVALUATION', 'REVIEW_REQUIRED'),
  ('POLICY_EVALUATION', 'READY'),
  ('POLICY_EVALUATION', 'DENIED'),
  ('POLICY_EVALUATION', 'INVALIDATED'),
  ('POLICY_EVALUATION', 'FAILED'),
  ('REVIEW_REQUIRED', 'APPROVED'),
  ('REVIEW_REQUIRED', 'DENIED'),
  ('REVIEW_REQUIRED', 'INVALIDATED'),
  ('REVIEW_REQUIRED', 'EXPIRED'),
  ('REVIEW_REQUIRED', 'CANCELLED'),
  ('APPROVED', 'READY'),
  ('APPROVED', 'INVALIDATED'),
  ('APPROVED', 'EXPIRED'),
  ('APPROVED', 'CANCELLED'),
  ('READY', 'EXECUTING'),
  ('READY', 'INVALIDATED'),
  ('READY', 'EXPIRED'),
  ('READY', 'CANCELLED'),
  ('EXECUTING', 'EXECUTED'),
  ('EXECUTING', 'FAILED'),
  ('EXECUTED', 'RECEIPTED'),
  ('EXECUTED', 'FAILED'),
  ('INVALIDATED', 'POLICY_EVALUATION'),
  ('INVALIDATED', 'CANCELLED'),
  ('EXPIRED', 'POLICY_EVALUATION'),
  ('EXPIRED', 'CANCELLED'),
  ('FAILED', 'POLICY_EVALUATION'),
  ('FAILED', 'CANCELLED');

-- 3. Core Action and Envelope Tables
CREATE TABLE control_plane_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  current_state execution_state_enum NOT NULL DEFAULT 'DRAFT',
  current_envelope_hash sha256_hash,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_action_org UNIQUE (id, organization_id)
);

CREATE TABLE action_envelope_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  envelope_hash sha256_hash NOT NULL,
  canonical_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT fk_envelope_action FOREIGN KEY (action_id, organization_id) 
    REFERENCES control_plane_actions(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT uq_envelope_hash UNIQUE (action_id, envelope_hash)
);

ALTER TABLE control_plane_actions
  ADD CONSTRAINT fk_action_current_envelope
  FOREIGN KEY (action_id, current_envelope_hash)
  REFERENCES action_envelope_versions(action_id, envelope_hash) ON DELETE RESTRICT;

-- 4. Policy Decisions
CREATE TABLE policy_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  envelope_hash sha256_hash NOT NULL,
  policy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  decision policy_decision_enum NOT NULL,
  evaluated_gates JSONB NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ,
  CONSTRAINT fk_policy_envelope FOREIGN KEY (action_id, envelope_hash)
    REFERENCES action_envelope_versions(action_id, envelope_hash) ON DELETE RESTRICT
);

-- 5. Approval Requests & Decisions
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  envelope_hash sha256_hash NOT NULL,
  request_state approval_state_enum NOT NULL DEFAULT 'PENDING',
  requirements_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ,
  CONSTRAINT fk_approval_envelope FOREIGN KEY (action_id, envelope_hash)
    REFERENCES action_envelope_versions(action_id, envelope_hash) ON DELETE RESTRICT
);

CREATE TABLE approval_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE RESTRICT,
  requirement_id TEXT NOT NULL,
  approver_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
  envelope_hash sha256_hash NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_approver_requirement UNIQUE (request_id, requirement_id, approver_id)
);

-- 6. Authority Grants
CREATE TABLE authority_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  approver_id UUID NOT NULL,
  role TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE authority_grant_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES authority_grants(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 7. Append-Only State and Provenance Events
CREATE TABLE action_state_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  from_state execution_state_enum NOT NULL,
  to_state execution_state_enum NOT NULL,
  transition_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT fk_state_event_action FOREIGN KEY (action_id, organization_id)
    REFERENCES control_plane_actions(id, organization_id) ON DELETE RESTRICT
);

CREATE TABLE provenance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  action_id UUID NOT NULL,
  envelope_hash sha256_hash,
  source TEXT NOT NULL,
  fact_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 8. Idempotency Claims and Execution Attempts
CREATE TABLE idempotency_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  envelope_hash sha256_hash NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT fk_idempotency_envelope FOREIGN KEY (action_id, envelope_hash)
    REFERENCES action_envelope_versions(action_id, envelope_hash) ON DELETE RESTRICT
);

CREATE TABLE action_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  envelope_hash sha256_hash NOT NULL,
  attempt_number INT NOT NULL,
  status attempt_status_enum NOT NULL DEFAULT 'STARTED',
  started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  ended_at TIMESTAMPTZ,
  CONSTRAINT fk_attempt_envelope FOREIGN KEY (action_id, envelope_hash)
    REFERENCES action_envelope_versions(action_id, envelope_hash) ON DELETE RESTRICT,
  CONSTRAINT uq_action_attempt_num UNIQUE (action_id, attempt_number)
);

CREATE TABLE execution_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES action_attempts(id) ON DELETE RESTRICT,
  action_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  status TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE execution_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES action_attempts(id) ON DELETE RESTRICT,
  action_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  error_code TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE attempt_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES action_attempts(id) ON DELETE RESTRICT,
  action_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  resolution_status TEXT NOT NULL,
  notes TEXT,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 9. Row Level Security (RLS) Configuration
ALTER TABLE control_plane_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_envelope_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE authority_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_state_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE provenance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_actions ON control_plane_actions
  USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY tenant_isolation_envelopes ON action_envelope_versions
  USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY tenant_isolation_policy ON policy_decisions
  USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY tenant_isolation_approval_requests ON approval_requests
  USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY tenant_isolation_attempts ON action_attempts
  USING (organization_id = current_setting('app.current_organization_id')::UUID);


-- 10. Security Definer Functions
CREATE OR REPLACE FUNCTION guarded_create_attempt(
  p_action_id UUID,
  p_organization_id UUID,
  p_envelope_hash sha256_hash,
  p_idempotency_key TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session_org UUID;
  v_unknown_count INT;
  v_next_attempt_num INT;
  v_attempt_id UUID;
BEGIN
  v_session_org := current_setting('app.current_organization_id')::UUID;
  IF v_session_org IS NULL OR v_session_org <> p_organization_id THEN
    RAISE EXCEPTION 'Security Exception: Tenant context mismatch or missing.';
  END IF;

  -- Lock action row
  PERFORM 1 FROM control_plane_actions
  WHERE id = p_action_id AND organization_id = p_organization_id
  FOR UPDATE;

  -- Check for unresolved unknown outcome attempts
  SELECT COUNT(*) INTO v_unknown_count
  FROM action_attempts a
  LEFT JOIN attempt_reconciliations r ON a.id = r.attempt_id
  WHERE a.action_id = p_action_id
    AND a.status = 'EXECUTION_OUTCOME_UNKNOWN'
    AND r.id IS NULL;

  IF v_unknown_count > 0 THEN
    RAISE EXCEPTION 'Execution Blocked: Unresolved prior attempt with EXECUTION_OUTCOME_UNKNOWN exists.';
  END IF;

  -- Record idempotency claim
  INSERT INTO idempotency_claims (action_id, organization_id, envelope_hash, idempotency_key)
  VALUES (p_action_id, p_organization_id, p_envelope_hash, p_idempotency_key);

  -- Allocate next attempt number
  SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO v_next_attempt_num
  FROM action_attempts
  WHERE action_id = p_action_id;

  INSERT INTO action_attempts (action_id, organization_id, envelope_hash, attempt_number, status)
  VALUES (p_action_id, p_organization_id, p_envelope_hash, v_next_attempt_num, 'STARTED')
  RETURNING id INTO v_attempt_id;

  RETURN v_attempt_id;
END;
$$;
