-- ============================================================
-- Migration 001: Initial Schema
-- Platform: Xccelera AI-Driven SDLC Platform
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Organizations (tenants) ──────────────────────────────────
CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    plan        TEXT NOT NULL DEFAULT 'starter',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    password_hash   TEXT,
    role            TEXT NOT NULL DEFAULT 'developer',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    mfa_enabled     BOOLEAN NOT NULL DEFAULT false,
    mfa_secret      TEXT,
    sso_provider    TEXT,
    sso_subject     TEXT,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, email)
);

CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_users_email ON users(email);

-- ── Roles & Permissions ──────────────────────────────────────
CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    is_system   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, name)
);

CREATE TABLE role_permissions (
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission  TEXT NOT NULL,
    PRIMARY KEY (role_id, permission)
);

CREATE TABLE user_roles (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- ── Projects ─────────────────────────────────────────────────
CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'active',
    tech_stack      TEXT[] DEFAULT '{}',
    repository_url  TEXT,
    owner_id        UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_org_id ON projects(org_id);

-- ── Requirements ─────────────────────────────────────────────
CREATE TABLE requirements (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    acceptance_criteria TEXT[] DEFAULT '{}',
    priority            TEXT NOT NULL DEFAULT 'medium',
    status              TEXT NOT NULL DEFAULT 'draft',
    source_req_id       TEXT,
    version             INTEGER NOT NULL DEFAULT 1,
    ai_generated        BOOLEAN NOT NULL DEFAULT false,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_requirements_project_id ON requirements(project_id);
CREATE INDEX idx_requirements_status ON requirements(status);

-- ── Backlog Items ─────────────────────────────────────────────
CREATE TABLE backlog_items (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    requirement_id      UUID REFERENCES requirements(id),
    sprint_id           UUID,
    title               TEXT NOT NULL,
    description         TEXT,
    acceptance_criteria TEXT[] DEFAULT '{}',
    priority            TEXT NOT NULL DEFAULT 'medium',
    story_points        INTEGER,
    status              TEXT NOT NULL DEFAULT 'backlog',
    ai_generated        BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_backlog_items_project_id ON backlog_items(project_id);
CREATE INDEX idx_backlog_items_sprint_id ON backlog_items(sprint_id);

-- ── Sprints ───────────────────────────────────────────────────
CREATE TABLE sprints (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    goal                TEXT,
    start_date          DATE,
    end_date            DATE,
    capacity_points     INTEGER,
    status              TEXT NOT NULL DEFAULT 'planned',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sprints_project_id ON sprints(project_id);

-- Add FK back reference on backlog_items
ALTER TABLE backlog_items ADD CONSTRAINT fk_sprint FOREIGN KEY (sprint_id) REFERENCES sprints(id);

-- ── AI Jobs ───────────────────────────────────────────────────
CREATE TABLE ai_jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    requirement_id  UUID REFERENCES requirements(id),
    engine          TEXT NOT NULL,
    trigger_source  TEXT NOT NULL,
    priority        TEXT NOT NULL DEFAULT 'medium',
    status          TEXT NOT NULL DEFAULT 'queued',
    payload         JSONB NOT NULL DEFAULT '{}',
    result          JSONB,
    error_message   TEXT,
    attempt_count   INTEGER NOT NULL DEFAULT 0,
    callback_url    TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_jobs_project_id ON ai_jobs(project_id);
CREATE INDEX idx_ai_jobs_status ON ai_jobs(status);
CREATE INDEX idx_ai_jobs_engine ON ai_jobs(engine);

-- ── Test Cases ────────────────────────────────────────────────
CREATE TABLE test_cases (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    requirement_id  UUID REFERENCES requirements(id),
    ai_job_id       UUID REFERENCES ai_jobs(id),
    title           TEXT NOT NULL,
    description     TEXT,
    type            TEXT NOT NULL DEFAULT 'unit',
    steps           TEXT[] DEFAULT '{}',
    expected_result TEXT,
    ai_generated    BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_test_cases_project_id ON test_cases(project_id);

-- ── Test Runs ─────────────────────────────────────────────────
CREATE TABLE test_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'queued',
    total_cases     INTEGER NOT NULL DEFAULT 0,
    passed          INTEGER NOT NULL DEFAULT 0,
    failed          INTEGER NOT NULL DEFAULT 0,
    skipped         INTEGER NOT NULL DEFAULT 0,
    coverage_pct    NUMERIC(5,2),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE test_run_results (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id          UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    test_case_id    UUID NOT NULL REFERENCES test_cases(id),
    status          TEXT NOT NULL,
    duration_ms     INTEGER,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Deployments ───────────────────────────────────────────────
CREATE TABLE environments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    type                TEXT NOT NULL,
    config              JSONB DEFAULT '{}',
    requires_approval   BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE deployments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    environment_id  UUID REFERENCES environments(id),
    environment     TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    version         TEXT,
    triggered_by    TEXT NOT NULL DEFAULT 'manual',
    triggered_by_user UUID REFERENCES users(id),
    pipeline_run_id UUID,
    rollback_of     UUID REFERENCES deployments(id),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deployments_project_id ON deployments(project_id);

-- ── Approval Gates ────────────────────────────────────────────
CREATE TABLE approval_gates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deployment_id   UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending',
    requested_by    UUID REFERENCES users(id),
    approved_by     UUID REFERENCES users(id),
    comment         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at      TIMESTAMPTZ
);

-- ── Traceability Links ────────────────────────────────────────
CREATE TABLE traceability_links (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_id      UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    entity_type         TEXT NOT NULL,   -- 'backlog_item', 'ai_job', 'test_case', 'deployment'
    entity_id           UUID NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_traceability_requirement_id ON traceability_links(requirement_id);
CREATE INDEX idx_traceability_entity ON traceability_links(entity_type, entity_id);

-- ── CI/CD Pipelines ───────────────────────────────────────────
CREATE TABLE pipelines (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    stages      JSONB NOT NULL DEFAULT '[]',
    trigger     TEXT NOT NULL DEFAULT 'manual',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pipeline_runs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'pending',
    commit_sha  TEXT,
    started_at  TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Agent Registry ────────────────────────────────────────────
CREATE TABLE agents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    owner_id        UUID REFERENCES users(id),
    status          TEXT NOT NULL DEFAULT 'draft',
    capabilities    TEXT[] DEFAULT '{}',
    tools           TEXT[] DEFAULT '{}',
    behavioral_rules TEXT[] DEFAULT '{}',
    version         INTEGER NOT NULL DEFAULT 1,
    docker_image    TEXT,
    mee_enabled     BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_versions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    version         INTEGER NOT NULL,
    docker_image    TEXT NOT NULL,
    changelog       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(agent_id, version)
);

-- ── Legacy Conversion Jobs ────────────────────────────────────
CREATE TABLE legacy_conversion_jobs (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    job_type                TEXT NOT NULL,
    source_language         TEXT,
    target_language         TEXT,
    status                  TEXT NOT NULL DEFAULT 'queued',
    progress_percentage     INTEGER NOT NULL DEFAULT 0,
    files_total             INTEGER NOT NULL DEFAULT 0,
    files_converted         INTEGER NOT NULL DEFAULT 0,
    artifact_url            TEXT,
    estimated_completion    TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Updated_at trigger helper ─────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['organizations','users','projects','requirements','backlog_items','sprints','ai_jobs','pipelines','agents','legacy_conversion_jobs']
    LOOP
        EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
    END LOOP;
END;
$$;
