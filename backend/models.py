"""
Xccelera AI-SDLC Platform — SQLAlchemy ORM models.

All primary keys are UUID strings (str(uuid.uuid4())).
All timestamps default to datetime.utcnow.
"""

import uuid
from datetime import datetime
from typing import List

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


# ---------------------------------------------------------------------------
# Helper defaults
# ---------------------------------------------------------------------------


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.utcnow()


# ---------------------------------------------------------------------------
# 1. Organization
# ---------------------------------------------------------------------------


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    plan: Mapped[str] = mapped_column(String(50), default="starter", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now, onupdate=_now, nullable=False
    )

    # Relationships
    users: Mapped[List["User"]] = relationship(
        "User", back_populates="organization", cascade="all, delete-orphan"
    )
    projects: Mapped[List["Project"]] = relationship(
        "Project", back_populates="organization", cascade="all, delete-orphan"
    )
    ai_jobs: Mapped[List["AIJob"]] = relationship(
        "AIJob", back_populates="organization"
    )
    mee_events: Mapped[List["MEEEvent"]] = relationship(
        "MEEEvent", back_populates="organization"
    )
    agents: Mapped[List["AgentRecord"]] = relationship(
        "AgentRecord", back_populates="organization", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# 2. User
# ---------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("org_id", "email", name="uq_user_org_email"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    org_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="developer", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now, onupdate=_now, nullable=False
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization", back_populates="users"
    )
    owned_projects: Mapped[List["Project"]] = relationship(
        "Project", back_populates="owner", foreign_keys="Project.owner_id"
    )
    requirements_created: Mapped[List["Requirement"]] = relationship(
        "Requirement", back_populates="creator", foreign_keys="Requirement.created_by"
    )
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )
    agents_owned: Mapped[List["AgentRecord"]] = relationship(
        "AgentRecord", back_populates="owner", foreign_keys="AgentRecord.owner_id"
    )


# ---------------------------------------------------------------------------
# 3. Project
# ---------------------------------------------------------------------------


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    org_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    tech_stack: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    repository_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    owner_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now, onupdate=_now, nullable=False
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization", back_populates="projects"
    )
    owner: Mapped["User | None"] = relationship(
        "User", back_populates="owned_projects", foreign_keys=[owner_id]
    )
    requirements: Mapped[List["Requirement"]] = relationship(
        "Requirement", back_populates="project", cascade="all, delete-orphan"
    )
    backlog_items: Mapped[List["BacklogItem"]] = relationship(
        "BacklogItem", back_populates="project", cascade="all, delete-orphan"
    )
    sprints: Mapped[List["Sprint"]] = relationship(
        "Sprint", back_populates="project", cascade="all, delete-orphan"
    )
    ai_jobs: Mapped[List["AIJob"]] = relationship(
        "AIJob", back_populates="project", cascade="all, delete-orphan"
    )
    test_cases: Mapped[List["TestCase"]] = relationship(
        "TestCase", back_populates="project", cascade="all, delete-orphan"
    )
    test_runs: Mapped[List["TestRun"]] = relationship(
        "TestRun", back_populates="project", cascade="all, delete-orphan"
    )
    deployments: Mapped[List["Deployment"]] = relationship(
        "Deployment", back_populates="project", cascade="all, delete-orphan"
    )
    pipelines: Mapped[List["Pipeline"]] = relationship(
        "Pipeline", back_populates="project", cascade="all, delete-orphan"
    )
    legacy_jobs: Mapped[List["LegacyJob"]] = relationship(
        "LegacyJob", back_populates="project", cascade="all, delete-orphan"
    )
    extraction_jobs: Mapped[List["ExtractionJob"]] = relationship(
        "ExtractionJob", back_populates="project", cascade="all, delete-orphan"
    )
    design_artifacts: Mapped[List["DesignArtifact"]] = relationship(
        "DesignArtifact", back_populates="project", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# 4. Requirement
# ---------------------------------------------------------------------------


class Requirement(Base):
    __tablename__ = "requirements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    org_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    acceptance_criteria: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    priority: Mapped[str] = mapped_column(String(50), default="medium", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now, onupdate=_now, nullable=False
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="requirements")
    creator: Mapped["User | None"] = relationship(
        "User", back_populates="requirements_created", foreign_keys=[created_by]
    )
    backlog_items: Mapped[List["BacklogItem"]] = relationship(
        "BacklogItem", back_populates="requirement"
    )
    ai_jobs: Mapped[List["AIJob"]] = relationship(
        "AIJob", back_populates="requirement"
    )
    test_cases: Mapped[List["TestCase"]] = relationship(
        "TestCase", back_populates="requirement"
    )


# ---------------------------------------------------------------------------
# 5. BacklogItem
# ---------------------------------------------------------------------------


class BacklogItem(Base):
    __tablename__ = "backlog_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    requirement_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("requirements.id", ondelete="SET NULL"), nullable=True
    )
    sprint_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    acceptance_criteria: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    priority: Mapped[str] = mapped_column(String(50), default="medium", nullable=False)
    story_points: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="backlog", nullable=False)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now, onupdate=_now, nullable=False
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="backlog_items")
    requirement: Mapped["Requirement | None"] = relationship(
        "Requirement", back_populates="backlog_items"
    )


# ---------------------------------------------------------------------------
# 6. Sprint
# ---------------------------------------------------------------------------


class Sprint(Base):
    __tablename__ = "sprints"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    goal: Mapped[str] = mapped_column(Text, nullable=False, default="")
    start_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    end_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    capacity_points: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="planned", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now, onupdate=_now, nullable=False
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="sprints")


# ---------------------------------------------------------------------------
# 7. AIJob
# ---------------------------------------------------------------------------


class AIJob(Base):
    __tablename__ = "ai_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    org_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    requirement_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("requirements.id", ondelete="SET NULL"), nullable=True
    )
    engine: Mapped[str] = mapped_column(String(100), nullable=False)
    trigger_source: Mapped[str] = mapped_column(String(100), nullable=False)
    priority: Mapped[str] = mapped_column(String(50), default="medium", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="queued", nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now, onupdate=_now, nullable=False
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization", back_populates="ai_jobs"
    )
    project: Mapped["Project"] = relationship("Project", back_populates="ai_jobs")
    requirement: Mapped["Requirement | None"] = relationship(
        "Requirement", back_populates="ai_jobs"
    )
    test_cases: Mapped[List["TestCase"]] = relationship(
        "TestCase", back_populates="ai_job"
    )


# ---------------------------------------------------------------------------
# 8. TestCase
# ---------------------------------------------------------------------------


class TestCase(Base):
    __tablename__ = "test_cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    requirement_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("requirements.id", ondelete="SET NULL"), nullable=True
    )
    ai_job_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("ai_jobs.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    type: Mapped[str] = mapped_column(String(50), default="unit", nullable=False)
    steps: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    expected_result: Mapped[str] = mapped_column(Text, nullable=False, default="")
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="test_cases")
    requirement: Mapped["Requirement | None"] = relationship(
        "Requirement", back_populates="test_cases"
    )
    ai_job: Mapped["AIJob | None"] = relationship("AIJob", back_populates="test_cases")


# ---------------------------------------------------------------------------
# 9. TestRun
# ---------------------------------------------------------------------------


class TestRun(Base):
    __tablename__ = "test_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(50), default="queued", nullable=False)
    total_cases: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    passed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    skipped: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    coverage_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="test_runs")


# ---------------------------------------------------------------------------
# 10. Deployment
# ---------------------------------------------------------------------------


class Deployment(Base):
    __tablename__ = "deployments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    environment: Mapped[str] = mapped_column(String(50), default="dev", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    triggered_by: Mapped[str] = mapped_column(
        String(100), default="manual", nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="deployments")


# ---------------------------------------------------------------------------
# 11. Pipeline
# ---------------------------------------------------------------------------


class Pipeline(Base):
    __tablename__ = "pipelines"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    stages: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    trigger: Mapped[str] = mapped_column(String(50), default="manual", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now, onupdate=_now, nullable=False
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="pipelines")
    runs: Mapped[List["PipelineRun"]] = relationship(
        "PipelineRun", back_populates="pipeline", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# 12. PipelineRun
# ---------------------------------------------------------------------------


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    pipeline_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    commit_sha: Mapped[str | None] = mapped_column(String(255), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)

    # Relationships
    pipeline: Mapped["Pipeline"] = relationship("Pipeline", back_populates="runs")


# ---------------------------------------------------------------------------
# 13. MEEEvent  (Meta-Event Engine)
# ---------------------------------------------------------------------------


class MEEEvent(Base):
    __tablename__ = "mee_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    org_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True
    )
    project_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    engine: Mapped[str | None] = mapped_column(String(100), nullable=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    event_metadata: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    severity: Mapped[str] = mapped_column(String(50), default="info", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)

    # Relationships
    organization: Mapped["Organization | None"] = relationship(
        "Organization", back_populates="mee_events"
    )


# ---------------------------------------------------------------------------
# 14. AgentRecord
# ---------------------------------------------------------------------------


class AgentRecord(Base):
    __tablename__ = "agent_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    org_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    owner_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False)
    capabilities: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    tools: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    docker_image: Mapped[str | None] = mapped_column(String(512), nullable=True)
    mee_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now, onupdate=_now, nullable=False
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization", back_populates="agents"
    )
    owner: Mapped["User | None"] = relationship(
        "User", back_populates="agents_owned", foreign_keys=[owner_id]
    )


# ---------------------------------------------------------------------------
# 15. LegacyJob
# ---------------------------------------------------------------------------


class LegacyJob(Base):
    __tablename__ = "legacy_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    source_language: Mapped[str] = mapped_column(String(100), nullable=False)
    target_language: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="queued", nullable=False)
    progress_pct: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    files_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    files_converted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    report: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now, onupdate=_now, nullable=False
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="legacy_jobs")


# ---------------------------------------------------------------------------
# 16. ExtractionJob
# ---------------------------------------------------------------------------


class ExtractionJob(Base):
    __tablename__ = "extraction_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(50), default="queued", nullable=False)
    brd: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    process_flows: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    wiki: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now, onupdate=_now, nullable=False
    )

    # Relationships
    project: Mapped["Project"] = relationship(
        "Project", back_populates="extraction_jobs"
    )


# ---------------------------------------------------------------------------
# 17. DesignArtifact
# ---------------------------------------------------------------------------


class DesignArtifact(Base):
    __tablename__ = "design_artifacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)

    # Relationships
    project: Mapped["Project"] = relationship(
        "Project", back_populates="design_artifacts"
    )


# ---------------------------------------------------------------------------
# 18. RefreshToken
# ---------------------------------------------------------------------------


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token: Mapped[str] = mapped_column(String(512), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")
