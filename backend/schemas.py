"""
Xccelera AI-SDLC Platform — Pydantic v2 schemas.

All ORM-backed response schemas use:
    model_config = ConfigDict(from_attributes=True)
so they can be constructed directly from SQLAlchemy model instances.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


# ===========================================================================
# Auth
# ===========================================================================


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    org_name: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserResponse"


# ===========================================================================
# User
# ===========================================================================


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str
    role: str
    org_id: str
    is_active: bool
    created_at: datetime


# ===========================================================================
# Organization
# ===========================================================================


class OrgResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    plan: str
    is_active: bool
    created_at: datetime


# ===========================================================================
# Project
# ===========================================================================


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tech_stack: List[str] = []
    repository_url: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    tech_stack: Optional[List[str]] = None
    repository_url: Optional[str] = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: str
    name: str
    description: Optional[str]
    status: str
    tech_stack: List[str]
    repository_url: Optional[str]
    owner_id: Optional[str]
    created_at: datetime
    updated_at: datetime


# ===========================================================================
# Requirement
# ===========================================================================


class RequirementCreate(BaseModel):
    title: str
    description: str = ""
    acceptance_criteria: List[str] = []
    priority: str = "medium"
    source_text: Optional[str] = None


class RequirementUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    acceptance_criteria: Optional[List[str]] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    source_text: Optional[str] = None


class RequirementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    org_id: str
    title: str
    description: str
    acceptance_criteria: List[str]
    priority: str
    status: str
    version: int
    ai_generated: bool
    created_at: datetime
    updated_at: datetime


class NLPIntakeRequest(BaseModel):
    text: str
    project_id: str


class ConflictAnalysisRequest(BaseModel):
    project_id: str


# ===========================================================================
# BacklogItem
# ===========================================================================


class BacklogItemCreate(BaseModel):
    title: str
    description: str = ""
    requirement_id: Optional[str] = None
    sprint_id: Optional[str] = None
    priority: str = "medium"
    story_points: Optional[int] = None
    acceptance_criteria: List[str] = []


class BacklogItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    requirement_id: Optional[str] = None
    sprint_id: Optional[str] = None
    priority: Optional[str] = None
    story_points: Optional[int] = None
    status: Optional[str] = None
    acceptance_criteria: Optional[List[str]] = None


class BacklogItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    requirement_id: Optional[str]
    sprint_id: Optional[str]
    title: str
    description: str
    priority: str
    story_points: Optional[int]
    status: str
    ai_generated: bool
    acceptance_criteria: List[str]
    created_at: datetime


class GenerateBacklogRequest(BaseModel):
    project_id: str


# ===========================================================================
# Sprint
# ===========================================================================


class SprintCreate(BaseModel):
    name: str
    goal: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    capacity_points: Optional[int] = None


class SprintUpdate(BaseModel):
    name: Optional[str] = None
    goal: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    capacity_points: Optional[int] = None
    status: Optional[str] = None


class SprintResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    name: str
    goal: str
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    capacity_points: Optional[int]
    status: str
    created_at: datetime


class SprintPlanRequest(BaseModel):
    project_id: str
    sprint_id: Optional[str] = None
    velocity: int = 30
    capacity: int = 40


# ===========================================================================
# AIJob
# ===========================================================================


class AIJobCreate(BaseModel):
    project_id: str
    requirement_id: Optional[str] = None
    engine: str
    trigger_source: str
    priority: str = "medium"
    payload: dict = {}


class AIJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    org_id: str
    engine: str
    status: str
    priority: str
    trigger_source: str
    payload: dict
    result: Optional[dict]
    error_message: Optional[str]
    attempt_count: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime


class TriggerRequest(BaseModel):
    project_id: str
    requirement_id: Optional[str] = None
    payload: dict = {}


# ===========================================================================
# Design
# ===========================================================================


class TechStackRequest(BaseModel):
    project_description: str
    team_size: int = 5
    scale: str = "medium"


class ArchitectureRequest(BaseModel):
    project_description: str
    tech_stack: List[str] = []


class APIContractRequest(BaseModel):
    service_name: str
    requirements: List[str] = []


class DBSchemaRequest(BaseModel):
    entities: List[str]
    description: str = ""


class DesignReviewRequest(BaseModel):
    content: str
    type: str = "architecture"


class DesignResponse(BaseModel):
    type: str
    content: Any
    created_at: datetime


# ===========================================================================
# TestCase
# ===========================================================================


class TestCaseCreate(BaseModel):
    title: str
    description: str = ""
    type: str = "unit"
    steps: List[str] = []
    expected_result: str = ""
    requirement_id: Optional[str] = None


class TestCaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    title: str
    description: str
    type: str
    steps: List[str]
    expected_result: str
    ai_generated: bool
    requirement_id: Optional[str]
    created_at: datetime


class GenerateTestsRequest(BaseModel):
    project_id: str
    requirement_id: Optional[str] = None


class TestRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    status: str
    total_cases: int
    passed: int
    failed: int
    skipped: int
    coverage_pct: Optional[float]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime


# ===========================================================================
# Deployment
# ===========================================================================


class DeploymentCreate(BaseModel):
    project_id: str
    environment: str = "dev"
    version: Optional[str] = None
    triggered_by: str = "manual"


class DeploymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    environment: str
    status: str
    version: Optional[str]
    triggered_by: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime


class PipelineCreate(BaseModel):
    name: str
    stages: List[dict] = []
    trigger: str = "manual"


class PipelineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    name: str
    stages: List[dict]
    trigger: str
    created_at: datetime


# ===========================================================================
# MEE (Meta-Event Engine)
# ===========================================================================


class MEEEventCreate(BaseModel):
    project_id: Optional[str] = None
    engine: Optional[str] = None
    event_type: str
    description: str
    event_metadata: dict = {}
    severity: str = "info"


class MEEEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: Optional[str]
    engine: Optional[str]
    event_type: str
    description: str
    event_metadata: dict = {}
    severity: str
    created_at: datetime


# ===========================================================================
# Analytics
# ===========================================================================


class KPIResponse(BaseModel):
    project_id: str
    total_requirements: int
    completed_requirements: int
    total_backlog: int
    completed_backlog: int
    total_ai_jobs: int
    completed_ai_jobs: int
    test_coverage: Optional[float]
    deployment_count: int
    sprint_velocity: int


class DashboardResponse(BaseModel):
    project: ProjectResponse
    kpis: KPIResponse
    recent_jobs: List[AIJobResponse]
    recent_deployments: List[DeploymentResponse]


# ===========================================================================
# Agent
# ===========================================================================


class AgentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    capabilities: List[str] = []
    tools: List[str] = []


class AgentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: str
    name: str
    description: str
    status: str
    capabilities: List[str]
    tools: List[str]
    version: int
    mee_enabled: bool
    created_at: datetime


class GenerateAgentRequest(BaseModel):
    spec: str
    template: str = "general"


# ===========================================================================
# Legacy
# ===========================================================================


class LegacyJobCreate(BaseModel):
    source_language: str
    target_language: str
    source_code: str


class LegacyJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    source_language: str
    target_language: str
    status: str
    progress_pct: int
    files_total: int
    files_converted: int
    report: Optional[dict]
    created_at: datetime


# ===========================================================================
# Extraction
# ===========================================================================


class ExtractionRequest(BaseModel):
    project_id: str
    code_snippet: str


class ExtractionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    status: str
    brd: Optional[dict]
    process_flows: Optional[dict]
    wiki: Optional[dict]
    created_at: datetime


# ===========================================================================
# Pagination
# ===========================================================================


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int = 1
    page_size: int = 20


# ===========================================================================
# General
# ===========================================================================


class MessageResponse(BaseModel):
    message: str
    data: Optional[Any] = None


# ---------------------------------------------------------------------------
# Rebuild forward references so Pydantic resolves cross-model relationships
# ---------------------------------------------------------------------------

TokenResponse.model_rebuild()
DashboardResponse.model_rebuild()
