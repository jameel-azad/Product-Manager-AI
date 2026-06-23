from contextlib import asynccontextmanager
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Load .env from project root (one level up from backend/)
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, AsyncSessionLocal
from routers import (
    auth,
    projects,
    requirements,
    design,
    ai_orchestration,
    test_management,
    devops,
    mee,
    analytics,
    agents,
    legacy,
    extraction,
)

log = structlog.get_logger()


from auth import hash_password  # noqa: E402 — after sys path is set


async def seed_demo_data() -> None:
    """Seed the database with demo data on first start. Uses INSERT OR IGNORE / upsert logic."""
    from sqlalchemy import text

    async with AsyncSessionLocal() as session:
        now = datetime.now(timezone.utc).isoformat()

        # ------------------------------------------------------------------
        # 1. Default Organisation
        # ------------------------------------------------------------------
        await session.execute(
            text(
                """
                INSERT OR IGNORE INTO organizations (id, name, slug, plan, is_active, created_at, updated_at)
                VALUES (:id, :name, :slug, 'enterprise', 1, :created_at, :updated_at)
                """
            ),
            {
                "id": "org-demo-001",
                "name": "Xccelera AI",
                "slug": "xccelera-ai",
                "created_at": now,
                "updated_at": now,
            },
        )

        # ------------------------------------------------------------------
        # 2. Admin user
        # ------------------------------------------------------------------
        await session.execute(
            text(
                """
                INSERT OR IGNORE INTO users
                    (id, email, full_name, role, password_hash, org_id, is_active, mfa_enabled, created_at, updated_at)
                VALUES
                    (:id, :email, :full_name, :role, :password_hash, :org_id, 1, 0, :created_at, :updated_at)
                """
            ),
            {
                "id": "user-admin-001",
                "email": "admin@xccelera.ai",
                "full_name": "Admin User",
                "role": "project_manager",
                "password_hash": hash_password("demo123"),
                "org_id": "org-demo-001",
                "created_at": now,
                "updated_at": now,
            },
        )

        # ------------------------------------------------------------------
        # 3. Demo developer user
        # ------------------------------------------------------------------
        await session.execute(
            text(
                """
                INSERT OR IGNORE INTO users
                    (id, email, full_name, role, password_hash, org_id, is_active, mfa_enabled, created_at, updated_at)
                VALUES
                    (:id, :email, :full_name, :role, :password_hash, :org_id, 1, 0, :created_at, :updated_at)
                """
            ),
            {
                "id": "user-dev-001",
                "email": "demo@xccelera.ai",
                "full_name": "Demo Developer",
                "role": "developer",
                "password_hash": hash_password("demo123"),
                "org_id": "org-demo-001",
                "created_at": now,
                "updated_at": now,
            },
        )

        # ------------------------------------------------------------------
        # 4. Sample projects
        # ------------------------------------------------------------------
        projects_seed = [
            {
                "id": "proj-ecom-001",
                "name": "E-Commerce Platform",
                "description": "Full-stack e-commerce solution with AI-powered recommendations.",
                "status": "active",
                "tech_stack": '["React","FastAPI","PostgreSQL"]',
                "owner_id": "user-admin-001",
                "org_id": "org-demo-001",
            },
            {
                "id": "proj-bank-001",
                "name": "Mobile Banking App",
                "description": "Secure mobile banking application with real-time transaction processing.",
                "status": "active",
                "tech_stack": '["React Native","Node.js","MongoDB"]',
                "owner_id": "user-admin-001",
                "org_id": "org-demo-001",
            },
            {
                "id": "proj-legacy-001",
                "name": "Legacy Migration Project",
                "description": "Modernisation of legacy monolith to microservices architecture.",
                "status": "active",
                "tech_stack": '["Python","Java"]',
                "owner_id": "user-dev-001",
                "org_id": "org-demo-001",
            },
        ]

        for proj in projects_seed:
            await session.execute(
                text(
                    """
                    INSERT OR IGNORE INTO projects
                        (id, name, description, status, tech_stack, owner_id, org_id, created_at, updated_at)
                    VALUES
                        (:id, :name, :description, :status, :tech_stack, :owner_id, :org_id, :created_at, :updated_at)
                    """
                ),
                {**proj, "created_at": now, "updated_at": now},
            )

        # ------------------------------------------------------------------
        # 5. Sample requirements for E-Commerce Platform
        # ------------------------------------------------------------------
        requirements_seed = [
            {
                "id": "req-ecom-001",
                "project_id": "proj-ecom-001",
                "org_id": "org-demo-001",
                "title": "User Authentication & Authorisation",
                "description": "Users shall be able to register, log in, and manage their accounts securely using JWT tokens.",
                "priority": "high",
                "status": "approved",
            },
            {
                "id": "req-ecom-002",
                "project_id": "proj-ecom-001",
                "org_id": "org-demo-001",
                "title": "Product Catalogue",
                "description": "The system shall display a searchable, filterable product catalogue with pagination.",
                "priority": "high",
                "status": "approved",
            },
            {
                "id": "req-ecom-003",
                "project_id": "proj-ecom-001",
                "org_id": "org-demo-001",
                "title": "Shopping Cart & Checkout",
                "description": "Users shall be able to add items to a persistent cart and complete checkout via Stripe.",
                "priority": "high",
                "status": "draft",
            },
            {
                "id": "req-ecom-004",
                "project_id": "proj-ecom-001",
                "org_id": "org-demo-001",
                "title": "Performance — Page Load",
                "description": "All product listing pages shall load within 2 seconds under normal traffic conditions.",
                "priority": "medium",
                "status": "approved",
            },
            {
                "id": "req-ecom-005",
                "project_id": "proj-ecom-001",
                "org_id": "org-demo-001",
                "title": "AI Product Recommendations",
                "description": "The system shall surface personalised product recommendations using the MEE engine.",
                "priority": "medium",
                "status": "draft",
            },
        ]

        for req in requirements_seed:
            await session.execute(
                text(
                    """
                    INSERT OR IGNORE INTO requirements
                        (id, project_id, org_id, title, description, priority, status,
                         acceptance_criteria, version, ai_generated, created_by, created_at, updated_at)
                    VALUES
                        (:id, :project_id, :org_id, :title, :description, :priority, :status,
                         '[]', 1, 0, :created_by, :created_at, :updated_at)
                    """
                ),
                {**req, "created_by": "user-admin-001", "created_at": now, "updated_at": now},
            )

        # ------------------------------------------------------------------
        # 6. Sample AI jobs (completed)
        # ------------------------------------------------------------------
        ai_jobs_seed = [
            {
                "id": "job-ai-001",
                "org_id": "org-demo-001",
                "project_id": "proj-ecom-001",
                "engine": "ai_planning",
                "trigger_source": "manual",
                "status": "completed",
                "priority": "high",
                "payload": '{"task": "requirement_analysis"}',
                "result": '{"summary": "Identified 5 functional and 2 non-functional requirements."}',
            },
            {
                "id": "job-ai-002",
                "org_id": "org-demo-001",
                "project_id": "proj-ecom-001",
                "engine": "mee",
                "trigger_source": "manual",
                "status": "completed",
                "priority": "medium",
                "payload": '{"task": "test_generation"}',
                "result": '{"summary": "Generated 18 unit tests and 6 integration tests."}',
            },
            {
                "id": "job-ai-003",
                "org_id": "org-demo-001",
                "project_id": "proj-bank-001",
                "engine": "apix",
                "trigger_source": "manual",
                "status": "completed",
                "priority": "high",
                "payload": '{"task": "code_review"}',
                "result": '{"summary": "Found 3 security issues (1 critical, 2 medium)."}',
            },
        ]

        for job in ai_jobs_seed:
            await session.execute(
                text(
                    """
                    INSERT OR IGNORE INTO ai_jobs
                        (id, org_id, project_id, engine, trigger_source, status, priority,
                         payload, result, attempt_count, created_at, updated_at)
                    VALUES
                        (:id, :org_id, :project_id, :engine, :trigger_source, :status, :priority,
                         :payload, :result, 1, :created_at, :updated_at)
                    """
                ),
                {**job, "created_at": now, "updated_at": now},
            )

        # ------------------------------------------------------------------
        # 7. Sample MEE events
        # ------------------------------------------------------------------
        mee_events_seed = [
            {
                "id": "mee-evt-001",
                "org_id": "org-demo-001",
                "project_id": "proj-ecom-001",
                "engine": "recommendation-engine",
                "event_type": "model_drift_detected",
                "severity": "warning",
                "description": "Recommendation model accuracy dropped below threshold (0.72 < 0.80).",
                "event_metadata": '{"accuracy": 0.72, "threshold": 0.80, "model_version": "v2.1.0"}',
            },
            {
                "id": "mee-evt-002",
                "org_id": "org-demo-001",
                "project_id": "proj-bank-001",
                "engine": "fraud-detection",
                "event_type": "anomaly_detected",
                "severity": "critical",
                "description": "Unusual spike in failed transaction rate detected (12x baseline).",
                "event_metadata": '{"failed_rate": 0.034, "baseline_rate": 0.0028, "window_minutes": 5}',
            },
            {
                "id": "mee-evt-003",
                "org_id": "org-demo-001",
                "project_id": "proj-ecom-001",
                "engine": "product-catalogue",
                "event_type": "performance_degradation",
                "severity": "info",
                "description": "P99 latency increased to 1.8s, still within SLA.",
                "event_metadata": '{"p99_ms": 1800, "sla_ms": 2000}',
            },
        ]

        for evt in mee_events_seed:
            await session.execute(
                text(
                    """
                    INSERT OR IGNORE INTO mee_events
                        (id, org_id, project_id, engine, event_type, severity, description, event_metadata, created_at)
                    VALUES
                        (:id, :org_id, :project_id, :engine, :event_type, :severity, :description, :event_metadata, :created_at)
                    """
                ),
                {**evt, "created_at": now},
            )

        # ------------------------------------------------------------------
        # 8. Sample deployments
        # ------------------------------------------------------------------
        deployments_seed = [
            {
                "id": "deploy-001",
                "project_id": "proj-ecom-001",
                "environment": "production",
                "version": "v1.4.2",
                "status": "success",
                "triggered_by": "manual",
            },
            {
                "id": "deploy-002",
                "project_id": "proj-ecom-001",
                "environment": "staging",
                "version": "v1.5.0-rc1",
                "status": "success",
                "triggered_by": "ci",
            },
            {
                "id": "deploy-003",
                "project_id": "proj-bank-001",
                "environment": "production",
                "version": "v2.1.1",
                "status": "failed",
                "triggered_by": "manual",
            },
        ]

        for dep in deployments_seed:
            await session.execute(
                text(
                    """
                    INSERT OR IGNORE INTO deployments
                        (id, project_id, environment, version, status, triggered_by, created_at)
                    VALUES
                        (:id, :project_id, :environment, :version, :status, :triggered_by, :created_at)
                    """
                ),
                {**dep, "created_at": now},
            )

        # ------------------------------------------------------------------
        # 9. Sample test cases and test runs
        # ------------------------------------------------------------------
        test_cases_seed = [
            {
                "id": "tc-001",
                "project_id": "proj-ecom-001",
                "title": "User registers with valid credentials",
                "description": "Verify that a new user can register successfully and receives a JWT.",
                "type": "integration",
                "expected_result": "HTTP 201 with access_token in response body.",
            },
            {
                "id": "tc-002",
                "project_id": "proj-ecom-001",
                "title": "Add product to cart",
                "description": "Verify that a logged-in user can add a product to the shopping cart.",
                "type": "unit",
                "expected_result": "Cart item count increments by 1.",
            },
            {
                "id": "tc-003",
                "project_id": "proj-ecom-001",
                "title": "Product search returns relevant results",
                "description": "Verify that the search endpoint returns products matching the query term.",
                "type": "unit",
                "expected_result": "Results contain items with matching title or description.",
            },
            {
                "id": "tc-004",
                "project_id": "proj-bank-001",
                "title": "Initiate bank transfer within daily limit",
                "description": "Verify that a transfer within the daily limit is processed successfully.",
                "type": "integration",
                "expected_result": "Transfer status is 'completed' within 5 seconds.",
            },
        ]

        for tc in test_cases_seed:
            await session.execute(
                text(
                    """
                    INSERT OR IGNORE INTO test_cases
                        (id, project_id, title, description, type, expected_result,
                         steps, ai_generated, created_at)
                    VALUES
                        (:id, :project_id, :title, :description, :type, :expected_result,
                         '[]', 0, :created_at)
                    """
                ),
                {**tc, "created_at": now},
            )

        test_runs_seed = [
            {
                "id": "tr-001",
                "project_id": "proj-ecom-001",
                "status": "completed",
                "total_cases": 24,
                "passed": 22,
                "failed": 1,
                "skipped": 1,
                "coverage_pct": 87.5,
            },
            {
                "id": "tr-002",
                "project_id": "proj-bank-001",
                "status": "completed",
                "total_cases": 8,
                "passed": 6,
                "failed": 2,
                "skipped": 0,
                "coverage_pct": 74.0,
            },
        ]

        for tr in test_runs_seed:
            await session.execute(
                text(
                    """
                    INSERT OR IGNORE INTO test_runs
                        (id, project_id, status, total_cases, passed, failed, skipped, coverage_pct, created_at)
                    VALUES
                        (:id, :project_id, :status, :total_cases, :passed, :failed, :skipped, :coverage_pct, :created_at)
                    """
                ),
                {**tr, "created_at": now},
            )

        # ------------------------------------------------------------------
        # 10. Sample agents in registry
        # ------------------------------------------------------------------
        agents_seed = [
            {
                "id": "agent-req-001",
                "org_id": "org-demo-001",
                "name": "Requirements Analyst Agent",
                "description": "Extracts, clarifies, and structures requirements from raw input using Claude.",
                "status": "deployed",
                "version": 1,
                "capabilities": '["nlp_extraction","conflict_detection","prioritisation","traceability"]',
                "tools": '["claude-api","requirements-db"]',
            },
            {
                "id": "agent-test-001",
                "org_id": "org-demo-001",
                "name": "Test Generation Agent",
                "description": "Auto-generates unit, integration, and E2E test cases from requirements and code.",
                "status": "deployed",
                "version": 1,
                "capabilities": '["unit_tests","integration_tests","e2e_tests","coverage_analysis"]',
                "tools": '["claude-api","test-runner"]',
            },
            {
                "id": "agent-code-001",
                "org_id": "org-demo-001",
                "name": "Code Review Agent",
                "description": "Reviews pull requests for security, performance, and style issues.",
                "status": "deployed",
                "version": 2,
                "capabilities": '["security_scan","performance_analysis","style_check","dependency_audit"]',
                "tools": '["claude-api","github-api","sonarqube"]',
            },
            {
                "id": "agent-deploy-001",
                "org_id": "org-demo-001",
                "name": "DevOps Orchestration Agent",
                "description": "Manages CI/CD pipelines, rollbacks, and infrastructure scaling decisions.",
                "status": "deployed",
                "version": 1,
                "capabilities": '["pipeline_trigger","rollback","scaling","health_monitoring"]',
                "tools": '["claude-api","kubernetes-api","github-actions"]',
            },
            {
                "id": "agent-mee-001",
                "org_id": "org-demo-001",
                "name": "MEE Monitoring Agent",
                "description": "Continuously monitors model performance, drift, and anomalies in production.",
                "status": "deployed",
                "version": 1,
                "capabilities": '["drift_detection","anomaly_detection","alert_routing","auto_remediation"]',
                "tools": '["claude-api","influxdb","datadog"]',
            },
        ]

        for ag in agents_seed:
            await session.execute(
                text(
                    """
                    INSERT OR IGNORE INTO agent_records
                        (id, org_id, name, description, status, version, capabilities, tools,
                         mee_enabled, owner_id, created_at, updated_at)
                    VALUES
                        (:id, :org_id, :name, :description, :status, :version, :capabilities, :tools,
                         1, :owner_id, :created_at, :updated_at)
                    """
                ),
                {**ag, "owner_id": "user-admin-001", "created_at": now, "updated_at": now},
            )

        await session.commit()
        log.info("Demo seed data committed successfully")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Xccelera Platform starting...")
    await init_db()
    await seed_demo_data()
    log.info("Xccelera Platform ready at http://localhost:8000")
    log.info("API Docs: http://localhost:8000/docs")
    yield
    log.info("Xccelera Platform shutting down")


app = FastAPI(
    title="Xccelera AI-SDLC Platform",
    description="Unified AI-Driven Software Development Lifecycle Platform — Demo",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(requirements.router, prefix="/api/v1")
app.include_router(design.router, prefix="/api/v1")
app.include_router(ai_orchestration.router, prefix="/api/v1")
app.include_router(test_management.router, prefix="/api/v1")
app.include_router(devops.router, prefix="/api/v1")
app.include_router(mee.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(agents.router, prefix="/api/v1")
app.include_router(legacy.router, prefix="/api/v1")
app.include_router(extraction.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "message": "Xccelera AI-SDLC Platform",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running",
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "xccelera-platform",
        "version": "1.0.0",
    }
