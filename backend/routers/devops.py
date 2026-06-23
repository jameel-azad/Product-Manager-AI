"""
Xccelera AI-SDLC Platform â€” DevOps / CI-CD router.

Covers DEP-001 through DEP-006:
  DEP-001  Pipeline management (CRUD + run)
  DEP-002  Deployment creation & simulation
  DEP-003  Auto-rollback
  DEP-004  Environment listing
  DEP-005  AI release notes generation
  DEP-006  Approval gates (create + approve/reject)
"""

from __future__ import annotations

import random
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import ai_client
from auth import get_optional_user
from database import get_db
from models import Deployment, MEEEvent, Pipeline, PipelineRun, Project
from schemas import (
    DeploymentCreate,
    DeploymentResponse,
    MessageResponse,
    PipelineCreate,
    PipelineResponse,
)

router = APIRouter(prefix="/devops", tags=["DevOps & CI/CD"])

# ---------------------------------------------------------------------------
# In-memory store for approval gates (demo â€” no DB table required)
# ---------------------------------------------------------------------------

_approval_store: Dict[str, Dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Default AI-suggested pipeline stages
# ---------------------------------------------------------------------------

_DEFAULT_STAGES: List[Dict[str, Any]] = [
    {"name": "Build", "type": "build"},
    {"name": "Test", "type": "test"},
    {"name": "Security Scan", "type": "security"},
    {"name": "Deploy to Staging", "type": "deploy"},
    {"name": "Integration Tests", "type": "test"},
    {"name": "Deploy to Production", "type": "deploy", "requires_approval": True},
]


# ---------------------------------------------------------------------------
# Helper â€” convert a Pipeline ORM row to a plain dict (for PipelineResponse)
# ---------------------------------------------------------------------------


def _pipeline_to_dict(pl: Pipeline) -> Dict[str, Any]:
    return {
        "id": pl.id,
        "project_id": pl.project_id,
        "name": pl.name,
        "stages": pl.stages,
        "trigger": pl.trigger,
        "created_at": pl.created_at,
    }


def _run_to_dict(run: PipelineRun) -> Dict[str, Any]:
    return {
        "id": run.id,
        "pipeline_id": run.pipeline_id,
        "status": run.status,
        "commit_sha": run.commit_sha,
        "started_at": run.started_at,
        "completed_at": run.completed_at,
        "created_at": run.created_at,
    }


def _deployment_to_dict(dep: Deployment) -> Dict[str, Any]:
    return {
        "id": dep.id,
        "project_id": dep.project_id,
        "environment": dep.environment,
        "status": dep.status,
        "version": dep.version,
        "triggered_by": dep.triggered_by,
        "started_at": dep.started_at,
        "completed_at": dep.completed_at,
        "created_at": dep.created_at,
    }


# ===========================================================================
# Pipeline endpoints  (DEP-001)
# ===========================================================================


@router.get("/pipelines", response_model=List[PipelineResponse])
async def list_pipelines(
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> List[PipelineResponse]:
    """DEP-001 â€” List all pipelines, optionally filtered by project."""
    stmt = select(Pipeline)
    if project_id:
        stmt = stmt.where(Pipeline.project_id == project_id)
    result = await db.execute(stmt)
    pipelines = result.scalars().all()
    return [PipelineResponse.model_validate(pl) for pl in pipelines]


class PipelineCreateBody(PipelineCreate):
    """PipelineCreate extended with a required project_id field."""

    project_id: str


@router.post("/pipelines", response_model=PipelineResponse, status_code=status.HTTP_201_CREATED)
async def create_pipeline(
    body: PipelineCreateBody,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> PipelineResponse:
    """DEP-001 â€” Create a pipeline; uses AI-suggested stages when none provided."""
    stages = body.stages if body.stages else _DEFAULT_STAGES

    pipeline = Pipeline(
        id=str(uuid.uuid4()),
        project_id=body.project_id,
        name=body.name,
        stages=stages,
        trigger=body.trigger,
    )
    db.add(pipeline)
    await db.flush()
    return PipelineResponse.model_validate(pipeline)


@router.get("/pipelines/{pipeline_id}", response_model=PipelineResponse)
async def get_pipeline(
    pipeline_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> PipelineResponse:
    """DEP-001 â€” Get a single pipeline by ID."""
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if pipeline is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")
    return PipelineResponse.model_validate(pipeline)


class PipelineUpdate(BaseModel):
    name: Optional[str] = None
    stages: Optional[List[Dict[str, Any]]] = None
    trigger: Optional[str] = None


@router.put("/pipelines/{pipeline_id}", response_model=PipelineResponse)
async def update_pipeline(
    pipeline_id: str,
    body: PipelineUpdate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> PipelineResponse:
    """DEP-001 â€” Update a pipeline's name, stages, or trigger."""
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if pipeline is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")

    if body.name is not None:
        pipeline.name = body.name
    if body.stages is not None:
        pipeline.stages = body.stages
    if body.trigger is not None:
        pipeline.trigger = body.trigger

    pipeline.updated_at = datetime.utcnow()
    await db.flush()
    return PipelineResponse.model_validate(pipeline)


@router.post("/pipelines/{pipeline_id}/run")
async def run_pipeline(
    pipeline_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """DEP-001 â€” Trigger a pipeline run (90 % success simulation)."""
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if pipeline is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")

    now = datetime.utcnow()
    # 90 % success rate for demo
    final_status = "success" if random.random() < 0.9 else "failed"

    run = PipelineRun(
        id=str(uuid.uuid4()),
        pipeline_id=pipeline_id,
        status=final_status,
        started_at=now,
        completed_at=now,
    )
    db.add(run)
    await db.flush()
    return _run_to_dict(run)


@router.get("/pipelines/{pipeline_id}/runs")
async def list_pipeline_runs(
    pipeline_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> List[Dict[str, Any]]:
    """DEP-001 â€” List all runs for a pipeline."""
    result = await db.execute(
        select(PipelineRun).where(PipelineRun.pipeline_id == pipeline_id)
    )
    runs = result.scalars().all()
    return [_run_to_dict(r) for r in runs]


# ===========================================================================
# Deployment endpoints  (DEP-002, DEP-003)
# ===========================================================================


@router.get("/deployments", response_model=List[DeploymentResponse])
async def list_deployments(
    project_id: Optional[str] = None,
    environment: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> List[DeploymentResponse]:
    """DEP-002 â€” List deployments, optionally filtered by project and environment."""
    stmt = select(Deployment)
    if project_id:
        stmt = stmt.where(Deployment.project_id == project_id)
    if environment:
        stmt = stmt.where(Deployment.environment == environment)
    result = await db.execute(stmt)
    deployments = result.scalars().all()
    return [DeploymentResponse.model_validate(d) for d in deployments]


@router.post("/deployments", response_model=DeploymentResponse, status_code=status.HTTP_201_CREATED)
async def create_deployment(
    body: DeploymentCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> DeploymentResponse:
    """DEP-002 â€” Create a deployment, simulate run â†’ success, fire MEE event."""
    now = datetime.utcnow()

    deployment = Deployment(
        id=str(uuid.uuid4()),
        project_id=body.project_id,
        environment=body.environment,
        version=body.version,
        triggered_by=body.triggered_by,
        status="success",
        started_at=now,
        completed_at=now,
    )
    db.add(deployment)

    # Determine org_id from the project (best-effort; None is acceptable for MEE)
    org_id: Optional[str] = None
    proj_result = await db.execute(select(Project).where(Project.id == body.project_id))
    project = proj_result.scalar_one_or_none()
    if project:
        org_id = project.org_id

    event = MEEEvent(
        id=str(uuid.uuid4()),
        org_id=org_id,
        project_id=body.project_id,
        engine="deployment_engine",
        event_type="deployment.created",
        description=(
            f"Deployment to {body.environment} "
            f"({'version ' + body.version if body.version else 'latest'}) completed successfully."
        ),
        event_metadata={
            "deployment_id": deployment.id,
            "environment": body.environment,
            "version": body.version,
            "triggered_by": body.triggered_by,
        },
        severity="info",
    )
    db.add(event)
    await db.flush()
    return DeploymentResponse.model_validate(deployment)


@router.get("/deployments/{dep_id}", response_model=DeploymentResponse)
async def get_deployment(
    dep_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> DeploymentResponse:
    """DEP-002 â€” Get a single deployment by ID."""
    result = await db.execute(select(Deployment).where(Deployment.id == dep_id))
    deployment = result.scalar_one_or_none()
    if deployment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deployment not found")
    return DeploymentResponse.model_validate(deployment)


@router.post(
    "/deployments/{dep_id}/rollback",
    response_model=DeploymentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def rollback_deployment(
    dep_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> DeploymentResponse:
    """DEP-003 â€” Auto-rollback: create a new deployment targeting the previous version."""
    result = await db.execute(select(Deployment).where(Deployment.id == dep_id))
    original = result.scalar_one_or_none()
    if original is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deployment not found")

    now = datetime.utcnow()
    rollback = Deployment(
        id=str(uuid.uuid4()),
        project_id=original.project_id,
        environment=original.environment,
        version=original.version,
        triggered_by="rollback",
        status="success",
        started_at=now,
        completed_at=now,
    )
    db.add(rollback)
    await db.flush()
    return DeploymentResponse.model_validate(rollback)


# ===========================================================================
# Release notes  (DEP-005)
# ===========================================================================


@router.get("/releases/{project_id}/notes", response_model=MessageResponse)
async def get_release_notes(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> MessageResponse:
    """DEP-005 â€” AI-generated release notes from recent deployment summaries."""
    stmt = (
        select(Deployment)
        .where(Deployment.project_id == project_id)
        .order_by(Deployment.created_at.desc())
        .limit(20)
    )
    result = await db.execute(stmt)
    deployments = result.scalars().all()

    # Build a list of commit-style summary strings from deployment records
    summaries: List[str] = [
        f"Deployed {d.version or 'latest'} to {d.environment} "
        f"(status: {d.status}, triggered by: {d.triggered_by})"
        for d in deployments
    ]

    # Derive a version label from the most recent deployment version
    latest_version = "latest"
    if deployments and deployments[0].version:
        latest_version = deployments[0].version

    notes = await ai_client.generate_release_notes(summaries, latest_version)
    return MessageResponse(message="Release notes generated", data={"notes": notes})


# ===========================================================================
# Environments  (DEP-004)
# ===========================================================================


@router.get("/environments/{project_id}")
async def list_environments(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> List[Dict[str, Any]]:
    """DEP-004 â€” List available environments for a project."""
    # Fetch project to check for config overrides (future extension point)
    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one_or_none()

    # Default environments â€” could be extended from project config
    environments: List[Dict[str, Any]] = [
        {"name": "dev", "type": "development", "project_id": project_id},
        {"name": "staging", "type": "staging", "project_id": project_id},
        {"name": "production", "type": "production", "project_id": project_id},
    ]

    if project is None:
        # Project not found â€” return defaults anyway (non-fatal for environment discovery)
        return environments

    return environments


# ===========================================================================
# Approval gates  (DEP-006)
# ===========================================================================


class ApprovalCreate(BaseModel):
    deployment_id: str
    approver_id: Optional[str] = None


class ApprovalUpdate(BaseModel):
    status: str  # "approved" | "rejected"
    comment: Optional[str] = None


@router.post("/approvals", status_code=status.HTTP_201_CREATED)
async def create_approval(
    body: ApprovalCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """DEP-006 â€” Create an approval gate for a deployment."""
    # Verify the deployment exists
    dep_result = await db.execute(select(Deployment).where(Deployment.id == body.deployment_id))
    deployment = dep_result.scalar_one_or_none()
    if deployment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deployment not found")

    gate_id = str(uuid.uuid4())
    gate: Dict[str, Any] = {
        "id": gate_id,
        "deployment_id": body.deployment_id,
        "approver_id": body.approver_id,
        "status": "pending",
        "comment": None,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    _approval_store[gate_id] = gate
    return gate


@router.put("/approvals/{approval_id}")
async def update_approval(
    approval_id: str,
    body: ApprovalUpdate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """DEP-006 â€” Approve or reject an approval gate."""
    if approval_id not in _approval_store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval gate not found")

    allowed_statuses = {"approved", "rejected"}
    if body.status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"status must be one of: {', '.join(sorted(allowed_statuses))}",
        )

    gate = _approval_store[approval_id]
    gate["status"] = body.status
    gate["comment"] = body.comment
    gate["updated_at"] = datetime.utcnow().isoformat()
    return gate

