"""
Shared Pydantic models used across all Xccelera platform services.
Import from this package to ensure consistent data contracts.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


# ── Enums ─────────────────────────────────────────────────────────────────────

class Priority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class AIJobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class AIEngine(str, Enum):
    APIX = "apix"
    UIX = "uix"
    INTEGRATIONX = "integrationx"
    MOBILE_AI = "mobile_ai"
    MEE = "mee"
    AGENT_DEVELOPER = "agent_developer"
    LEGACY_CONVERTER = "legacy_converter"
    BUSINESS_EXTRACTOR = "business_extractor"
    AI_PLANNING = "ai_planning"


class ProjectStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class RequirementStatus(str, Enum):
    DRAFT = "draft"
    REVIEWED = "reviewed"
    APPROVED = "approved"
    LINKED = "linked"
    DEPRECATED = "deprecated"


class DeploymentEnvironment(str, Enum):
    DEV = "dev"
    STAGING = "staging"
    PROD = "prod"


class DeploymentStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class UserRole(str, Enum):
    PROJECT_MANAGER = "project_manager"
    DEVELOPER = "developer"
    QA_ENGINEER = "qa_engineer"
    DEVOPS_ENGINEER = "devops_engineer"
    BUSINESS_STAKEHOLDER = "business_stakeholder"
    SYSTEM_ADMIN = "system_admin"


# ── Base Models ───────────────────────────────────────────────────────────────

class BaseEntity(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    tenant_id: UUID

    class Config:
        from_attributes = True


class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int
    pages: int


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    request_id: Optional[str] = None


# ── AI Job Models ─────────────────────────────────────────────────────────────

class AIJobCreate(BaseModel):
    engine: AIEngine
    project_id: UUID
    requirement_id: Optional[UUID] = None
    trigger_source: str
    priority: Priority = Priority.MEDIUM
    payload: dict[str, Any] = Field(default_factory=dict)
    callback_url: Optional[str] = None


class AIJob(BaseEntity):
    engine: AIEngine
    project_id: UUID
    requirement_id: Optional[UUID]
    trigger_source: str
    priority: Priority
    status: AIJobStatus = AIJobStatus.QUEUED
    payload: dict[str, Any]
    result: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None
    attempt_count: int = 0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    callback_url: Optional[str] = None


# ── MEE Event Models ──────────────────────────────────────────────────────────

class MEEEvent(BaseModel):
    event_id: UUID = Field(default_factory=uuid4)
    agent_id: str
    action_type: str
    project_id: UUID
    requirement_id: Optional[UUID] = None
    ai_job_id: Optional[UUID] = None
    input_hash: str
    output_hash: Optional[str] = None
    duration_ms: Optional[int] = None
    status: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    previous_event_hash: Optional[str] = None  # chain hash for tamper detection
