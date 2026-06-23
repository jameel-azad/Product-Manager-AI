"""
Xccelera AI-SDLC Platform â€” Requirements router.

Covers:
  - CRUD endpoints for Requirement management
  - POST /from-text  â€” NLP intake (PLN-001): AI-powered requirement generation
  - POST /analyze-conflicts â€” (PLN-005): AI conflict detection across requirements

All endpoints use get_optional_user for demo compatibility (unauthenticated
requests are accepted; when a valid token is supplied the user is recorded).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import ai_client
from auth import get_optional_user
from database import get_db
from models import MEEEvent, Project, Requirement
from schemas import (
    ConflictAnalysisRequest,
    MessageResponse,
    NLPIntakeRequest,
    RequirementCreate,
    RequirementResponse,
    RequirementUpdate,
)

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/requirements", tags=["Requirements"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.utcnow()


async def _get_requirement_or_404(
    req_id: str, db: AsyncSession
) -> Requirement:
    """Fetch a Requirement by primary key or raise HTTP 404."""
    result = await db.execute(select(Requirement).where(Requirement.id == req_id))
    req = result.scalar_one_or_none()
    if req is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Requirement '{req_id}' not found.",
        )
    return req


async def _get_project_or_404(project_id: str, db: AsyncSession) -> Project:
    """Fetch a Project by primary key or raise HTTP 404."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found.",
        )
    return project


def _record_mee_event(
    db: AsyncSession,
    *,
    org_id: Optional[str],
    project_id: Optional[str],
    event_type: str,
    description: str,
    event_metadata: Optional[dict] = None,
    severity: str = "info",
    engine: str = "PLN",
) -> MEEEvent:
    """
    Construct and add a MEEEvent to the current session (caller must flush/commit).
    Returns the unsaved MEEEvent instance.
    """
    event = MEEEvent(
        id=_uuid(),
        org_id=org_id,
        project_id=project_id,
        engine=engine,
        event_type=event_type,
        description=description,
        event_metadata=event_metadata or {},
        severity=severity,
        created_at=_now(),
    )
    db.add(event)
    return event


# ---------------------------------------------------------------------------
# 1. GET /  â€” list requirements
# ---------------------------------------------------------------------------


@router.get("/", response_model=List[RequirementResponse])
async def list_requirements(
    project_id: str = Query(..., description="ID of the parent project (required)."),
    status_filter: Optional[str] = Query(
        None, alias="status", description="Filter by status (e.g. draft, approved)."
    ),
    priority: Optional[str] = Query(
        None, description="Filter by priority (high, medium, low)."
    ),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_optional_user),
) -> List[RequirementResponse]:
    """Return all requirements for a project, with optional status/priority filters."""
    stmt = select(Requirement).where(Requirement.project_id == project_id)

    if status_filter:
        stmt = stmt.where(Requirement.status == status_filter)
    if priority:
        stmt = stmt.where(Requirement.priority == priority)

    stmt = stmt.order_by(Requirement.created_at.desc())
    result = await db.execute(stmt)
    requirements = result.scalars().all()
    return [RequirementResponse.model_validate(r) for r in requirements]


# ---------------------------------------------------------------------------
# 2. POST /  â€” create requirement
# ---------------------------------------------------------------------------


@router.post("/", response_model=RequirementResponse, status_code=status.HTTP_201_CREATED)
async def create_requirement(
    payload: RequirementCreate,
    project_id: str = Query(..., description="ID of the parent project."),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_optional_user),
) -> RequirementResponse:
    """Create a new requirement attached to the specified project."""
    project = await _get_project_or_404(project_id, db)

    req = Requirement(
        id=_uuid(),
        project_id=project.id,
        org_id=project.org_id,
        title=payload.title,
        description=payload.description,
        acceptance_criteria=payload.acceptance_criteria,
        priority=payload.priority,
        status="draft",
        version=1,
        ai_generated=False,
        source_text=payload.source_text,
        created_by=current_user.id if current_user else None,
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(req)
    await db.flush()
    await db.refresh(req)
    return RequirementResponse.model_validate(req)


# ---------------------------------------------------------------------------
# 3. GET /{req_id}  â€” get single requirement
# ---------------------------------------------------------------------------


@router.get("/{req_id}", response_model=RequirementResponse)
async def get_requirement(
    req_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_optional_user),
) -> RequirementResponse:
    """Retrieve a single requirement by its ID."""
    req = await _get_requirement_or_404(req_id, db)
    return RequirementResponse.model_validate(req)


# ---------------------------------------------------------------------------
# 4. PUT /{req_id}  â€” update requirement (increments version)
# ---------------------------------------------------------------------------


@router.put("/{req_id}", response_model=RequirementResponse)
async def update_requirement(
    req_id: str,
    payload: RequirementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_optional_user),
) -> RequirementResponse:
    """
    Update a requirement's fields.
    Every successful update increments the version counter by 1.
    """
    req = await _get_requirement_or_404(req_id, db)

    if payload.title is not None:
        req.title = payload.title
    if payload.description is not None:
        req.description = payload.description
    if payload.acceptance_criteria is not None:
        req.acceptance_criteria = payload.acceptance_criteria
    if payload.priority is not None:
        req.priority = payload.priority
    if payload.status is not None:
        req.status = payload.status
    if payload.source_text is not None:
        req.source_text = payload.source_text

    req.version = (req.version or 1) + 1
    req.updated_at = _now()

    db.add(req)
    await db.flush()
    await db.refresh(req)
    return RequirementResponse.model_validate(req)


# ---------------------------------------------------------------------------
# 5. DELETE /{req_id}  â€” delete requirement
# ---------------------------------------------------------------------------


@router.delete("/{req_id}", response_model=MessageResponse)
async def delete_requirement(
    req_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_optional_user),
) -> MessageResponse:
    """Permanently delete a requirement."""
    req = await _get_requirement_or_404(req_id, db)
    await db.delete(req)
    return MessageResponse(message=f"Requirement '{req_id}' deleted successfully.")


# ---------------------------------------------------------------------------
# 6. POST /{req_id}/approve  â€” approve a requirement
# ---------------------------------------------------------------------------


@router.post("/{req_id}/approve", response_model=RequirementResponse)
async def approve_requirement(
    req_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_optional_user),
) -> RequirementResponse:
    """Set a requirement's status to 'approved'."""
    req = await _get_requirement_or_404(req_id, db)

    req.status = "approved"
    req.updated_at = _now()

    db.add(req)
    await db.flush()
    await db.refresh(req)
    return RequirementResponse.model_validate(req)


# ---------------------------------------------------------------------------
# 7. GET /{req_id}/traceability  â€” traceability chain
# ---------------------------------------------------------------------------


@router.get("/{req_id}/traceability", response_model=dict)
async def get_traceability(
    req_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_optional_user),
) -> dict:
    """
    Return the full traceability chain for a requirement.

    The chain includes:
    - The requirement itself
    - Linked backlog items
    - Linked test cases
    - Linked AI jobs
    """
    from models import AIJob, BacklogItem, TestCase  # local import avoids circular deps

    req = await _get_requirement_or_404(req_id, db)

    # Backlog items linked to this requirement
    backlog_result = await db.execute(
        select(BacklogItem).where(BacklogItem.requirement_id == req_id)
    )
    backlog_items = backlog_result.scalars().all()

    # Test cases linked to this requirement
    test_result = await db.execute(
        select(TestCase).where(TestCase.requirement_id == req_id)
    )
    test_cases = test_result.scalars().all()

    # AI jobs linked to this requirement
    job_result = await db.execute(
        select(AIJob).where(AIJob.requirement_id == req_id)
    )
    ai_jobs = job_result.scalars().all()

    return {
        "requirement": {
            "id": req.id,
            "title": req.title,
            "status": req.status,
            "priority": req.priority,
            "version": req.version,
        },
        "backlog_items": [
            {"id": b.id, "title": b.title, "status": b.status, "story_points": b.story_points}
            for b in backlog_items
        ],
        "test_cases": [
            {"id": t.id, "title": t.title, "type": t.type}
            for t in test_cases
        ],
        "ai_jobs": [
            {"id": j.id, "engine": j.engine, "status": j.status, "trigger_source": j.trigger_source}
            for j in ai_jobs
        ],
    }


# ---------------------------------------------------------------------------
# 8. POST /from-text  â€” NLP intake (PLN-001)
# ---------------------------------------------------------------------------


@router.post("/from-text", response_model=List[RequirementResponse], status_code=status.HTTP_201_CREATED)
async def requirements_from_text(
    payload: NLPIntakeRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_optional_user),
) -> List[RequirementResponse]:
    """
    PLN-001 â€” NLP Intake.

    Accepts free-form business-goals text and a project ID.
    Calls the AI engine to decompose the text into structured requirements,
    persists each one with ai_generated=True, emits a MEEEvent, and returns
    the full list of created RequirementResponse objects.
    """
    project = await _get_project_or_404(payload.project_id, db)

    # Call AI engine
    generated: list[dict] = await ai_client.generate_requirements_from_text(payload.text)

    created_requirements: list[Requirement] = []
    for item in generated:
        req = Requirement(
            id=_uuid(),
            project_id=project.id,
            org_id=project.org_id,
            title=item.get("title", "Untitled Requirement"),
            description=item.get("description", ""),
            acceptance_criteria=item.get("acceptance_criteria", []),
            priority=item.get("priority", "medium"),
            status="draft",
            version=1,
            ai_generated=True,
            source_text=payload.text,
            created_by=current_user.id if current_user else None,
            created_at=_now(),
            updated_at=_now(),
        )
        db.add(req)
        created_requirements.append(req)

    # Flush to assign DB-side defaults before emitting the MEE event
    await db.flush()

    # Emit MEEEvent
    _record_mee_event(
        db,
        org_id=project.org_id,
        project_id=project.id,
        event_type="requirements.generated",
        description=(
            f"PLN-001: AI generated {len(created_requirements)} requirement(s) "
            f"from text input for project '{project.name}'."
        ),
        event_metadata={
            "project_id": project.id,
            "count": len(created_requirements),
            "requirement_ids": [r.id for r in created_requirements],
            "source_text_preview": payload.text[:200],
        },
        severity="info",
        engine="PLN-001",
    )

    await db.flush()

    # Refresh all instances to pick up any DB-side population
    for req in created_requirements:
        await db.refresh(req)

    return [RequirementResponse.model_validate(r) for r in created_requirements]


# ---------------------------------------------------------------------------
# 9. POST /analyze-conflicts  â€” PLN-005
# ---------------------------------------------------------------------------


@router.post("/analyze-conflicts", response_model=MessageResponse)
async def analyze_conflicts(
    payload: ConflictAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_optional_user),
) -> MessageResponse:
    """
    PLN-005 â€” Conflict Analysis.

    Fetches all requirements for the specified project, passes them to the AI
    conflict-detection engine, and returns the list of detected conflicts
    wrapped in a MessageResponse (data field contains the conflicts list).
    """
    project = await _get_project_or_404(payload.project_id, db)

    # Fetch all requirements for this project
    result = await db.execute(
        select(Requirement)
        .where(Requirement.project_id == payload.project_id)
        .order_by(Requirement.created_at.asc())
    )
    requirements = result.scalars().all()

    if not requirements:
        return MessageResponse(
            message="No requirements found for the project; nothing to analyse.",
            data=[],
        )

    # Serialise requirements for the AI client
    req_dicts = [
        {
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "acceptance_criteria": r.acceptance_criteria,
            "priority": r.priority,
            "status": r.status,
        }
        for r in requirements
    ]

    # Call AI engine
    conflicts: list[dict] = await ai_client.analyze_conflicts(req_dicts)

    return MessageResponse(
        message=(
            f"PLN-005: Conflict analysis complete for project '{project.name}'. "
            f"{len(conflicts)} conflict(s) detected across {len(requirements)} requirement(s)."
        ),
        data=conflicts,
    )

