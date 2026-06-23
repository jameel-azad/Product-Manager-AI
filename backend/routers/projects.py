"""
Xccelera AI-SDLC Platform â€” Projects router.

Handles project CRUD, backlog management, sprint management,
AI-driven backlog generation, AI sprint planning, and traceability matrix.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

import ai_client
import models
import schemas
from auth import get_current_user, get_optional_user
from database import get_db

router = APIRouter(prefix="/projects", tags=["Projects"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_project_or_404(
    project_id: str,
    db: AsyncSession,
    org_id: Optional[str] = None,
) -> models.Project:
    """Fetch a project by id, optionally scoped to an org. Raises 404 if missing."""
    stmt = select(models.Project).where(models.Project.id == project_id)
    if org_id:
        stmt = stmt.where(models.Project.org_id == org_id)
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found.",
        )
    return project


async def _get_backlog_item_or_404(
    item_id: str,
    project_id: str,
    db: AsyncSession,
) -> models.BacklogItem:
    """Fetch a backlog item by id scoped to project. Raises 404 if missing."""
    stmt = (
        select(models.BacklogItem)
        .where(
            models.BacklogItem.id == item_id,
            models.BacklogItem.project_id == project_id,
        )
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"BacklogItem '{item_id}' not found in project '{project_id}'.",
        )
    return item


async def _get_sprint_or_404(
    sprint_id: str,
    project_id: str,
    db: AsyncSession,
) -> models.Sprint:
    """Fetch a sprint by id scoped to project. Raises 404 if missing."""
    stmt = (
        select(models.Sprint)
        .where(
            models.Sprint.id == sprint_id,
            models.Sprint.project_id == project_id,
        )
    )
    result = await db.execute(stmt)
    sprint = result.scalar_one_or_none()
    if sprint is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sprint '{sprint_id}' not found in project '{project_id}'.",
        )
    return sprint


def _demo_org_id(user: Optional[models.User]) -> Optional[str]:
    """Return the user's org_id, or None when running in unauthenticated demo mode."""
    return user.org_id if user else None


# ---------------------------------------------------------------------------
# 1. GET /projects  â€” list all projects for the user's org
# ---------------------------------------------------------------------------


@router.get("/", response_model=List[schemas.ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    """List all non-archived projects, scoped to the authenticated user's org."""
    stmt = select(models.Project).where(models.Project.status != "archived")

    org_id = _demo_org_id(current_user)
    if org_id:
        stmt = stmt.where(models.Project.org_id == org_id)

    stmt = stmt.order_by(models.Project.created_at.desc())
    result = await db.execute(stmt)
    projects = result.scalars().all()
    return projects


# ---------------------------------------------------------------------------
# 2. POST /projects  â€” create project
# ---------------------------------------------------------------------------


@router.post("/", response_model=schemas.ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: schemas.ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create a new project in the current user's org."""
    project = models.Project(
        org_id=current_user.org_id,
        owner_id=current_user.id,
        name=payload.name,
        description=payload.description,
        tech_stack=payload.tech_stack,
        repository_url=payload.repository_url,
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return project


# ---------------------------------------------------------------------------
# 3. GET /projects/{project_id}  â€” get single project
# ---------------------------------------------------------------------------


@router.get("/{project_id}", response_model=schemas.ProjectResponse)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    """Fetch a single project by ID."""
    org_id = _demo_org_id(current_user)
    project = await _get_project_or_404(project_id, db, org_id)
    return project


# ---------------------------------------------------------------------------
# 4. PUT /projects/{project_id}  â€” update project
# ---------------------------------------------------------------------------


@router.put("/{project_id}", response_model=schemas.ProjectResponse)
async def update_project(
    project_id: str,
    payload: schemas.ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update mutable fields on an existing project."""
    project = await _get_project_or_404(project_id, db, current_user.org_id)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    await db.flush()
    await db.refresh(project)
    return project


# ---------------------------------------------------------------------------
# 5. DELETE /projects/{project_id}  â€” soft delete (archive)
# ---------------------------------------------------------------------------


@router.delete("/{project_id}", response_model=schemas.MessageResponse)
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Soft-delete a project by setting its status to 'archived'."""
    project = await _get_project_or_404(project_id, db, current_user.org_id)
    project.status = "archived"
    await db.flush()
    return schemas.MessageResponse(message=f"Project '{project.name}' archived successfully.")


# ===========================================================================
# Backlog
# ===========================================================================


# ---------------------------------------------------------------------------
# 6. GET /projects/{project_id}/backlog  â€” list backlog items
# ---------------------------------------------------------------------------


@router.get("/{project_id}/backlog", response_model=List[schemas.BacklogItemResponse])
async def list_backlog(
    project_id: str,
    sprint_id: Optional[str] = Query(default=None, description="Filter by sprint ID"),
    item_status: Optional[str] = Query(default=None, alias="status", description="Filter by status"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    """List backlog items for a project with optional filters."""
    org_id = _demo_org_id(current_user)
    await _get_project_or_404(project_id, db, org_id)

    stmt = select(models.BacklogItem).where(models.BacklogItem.project_id == project_id)

    if sprint_id is not None:
        stmt = stmt.where(models.BacklogItem.sprint_id == sprint_id)
    if item_status is not None:
        stmt = stmt.where(models.BacklogItem.status == item_status)

    stmt = stmt.order_by(models.BacklogItem.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


# ---------------------------------------------------------------------------
# 7. POST /projects/{project_id}/backlog  â€” create backlog item
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/backlog",
    response_model=schemas.BacklogItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_backlog_item(
    project_id: str,
    payload: schemas.BacklogItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create a new backlog item for a project."""
    await _get_project_or_404(project_id, db, current_user.org_id)

    item = models.BacklogItem(
        project_id=project_id,
        title=payload.title,
        description=payload.description,
        requirement_id=payload.requirement_id,
        sprint_id=payload.sprint_id,
        priority=payload.priority,
        story_points=payload.story_points,
        acceptance_criteria=payload.acceptance_criteria,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


# ---------------------------------------------------------------------------
# 8. PUT /projects/{project_id}/backlog/{item_id}  â€” update backlog item
# ---------------------------------------------------------------------------


@router.put(
    "/{project_id}/backlog/{item_id}",
    response_model=schemas.BacklogItemResponse,
)
async def update_backlog_item(
    project_id: str,
    item_id: str,
    payload: schemas.BacklogItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update fields on a backlog item."""
    await _get_project_or_404(project_id, db, current_user.org_id)
    item = await _get_backlog_item_or_404(item_id, project_id, db)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    await db.flush()
    await db.refresh(item)
    return item


# ---------------------------------------------------------------------------
# 9. DELETE /projects/{project_id}/backlog/{item_id}  â€” delete backlog item
# ---------------------------------------------------------------------------


@router.delete(
    "/{project_id}/backlog/{item_id}",
    response_model=schemas.MessageResponse,
)
async def delete_backlog_item(
    project_id: str,
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Permanently delete a backlog item."""
    await _get_project_or_404(project_id, db, current_user.org_id)
    item = await _get_backlog_item_or_404(item_id, project_id, db)
    await db.delete(item)
    await db.flush()
    return schemas.MessageResponse(message=f"BacklogItem '{item.title}' deleted successfully.")


# ---------------------------------------------------------------------------
# 10. POST /projects/{project_id}/backlog/generate  â€” AI generate backlog
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/backlog/generate",
    response_model=List[schemas.BacklogItemResponse],
    status_code=status.HTTP_201_CREATED,
)
async def generate_backlog(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Use AI to generate backlog items from existing project requirements.

    Fetches all requirements for the project, calls the AI engine, persists
    the generated items with ai_generated=True, and logs a MEEEvent.
    """
    project = await _get_project_or_404(project_id, db, current_user.org_id)

    # Fetch all requirements for this project
    req_result = await db.execute(
        select(models.Requirement).where(models.Requirement.project_id == project_id)
    )
    requirements = req_result.scalars().all()

    requirements_as_list = [
        {
            "id": req.id,
            "title": req.title,
            "description": req.description,
            "acceptance_criteria": req.acceptance_criteria,
            "priority": req.priority,
            "status": req.status,
        }
        for req in requirements
    ]

    # Call AI engine
    generated = await ai_client.generate_backlog(requirements_as_list, project.name)

    # Persist generated backlog items
    new_items: List[models.BacklogItem] = []
    for item_data in generated:
        item = models.BacklogItem(
            project_id=project_id,
            title=item_data.get("title", "Untitled"),
            description=item_data.get("description", ""),
            acceptance_criteria=item_data.get("acceptance_criteria", []),
            priority=item_data.get("priority", "medium"),
            story_points=item_data.get("story_points"),
            ai_generated=True,
        )
        db.add(item)
        new_items.append(item)

    await db.flush()
    for item in new_items:
        await db.refresh(item)

    # Log MEEEvent
    mee_event = models.MEEEvent(
        org_id=current_user.org_id,
        project_id=project_id,
        engine="backlog_engine",
        event_type="backlog_generated",
        description=(
            f"AI generated {len(new_items)} backlog items for project '{project.name}'."
        ),
        event_metadata={
            "project_id": project_id,
            "items_generated": len(new_items),
            "triggered_by": current_user.id,
        },
        severity="info",
    )
    db.add(mee_event)
    await db.flush()

    return new_items


# ===========================================================================
# Sprints
# ===========================================================================


# ---------------------------------------------------------------------------
# 11. GET /projects/{project_id}/sprints  â€” list sprints
# ---------------------------------------------------------------------------


@router.get("/{project_id}/sprints", response_model=List[schemas.SprintResponse])
async def list_sprints(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    """List all sprints for a project."""
    org_id = _demo_org_id(current_user)
    await _get_project_or_404(project_id, db, org_id)

    result = await db.execute(
        select(models.Sprint)
        .where(models.Sprint.project_id == project_id)
        .order_by(models.Sprint.created_at.asc())
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# 12. POST /projects/{project_id}/sprints  â€” create sprint
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/sprints",
    response_model=schemas.SprintResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_sprint(
    project_id: str,
    payload: schemas.SprintCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create a new sprint for a project."""
    await _get_project_or_404(project_id, db, current_user.org_id)

    sprint = models.Sprint(
        project_id=project_id,
        name=payload.name,
        goal=payload.goal or "",
        start_date=payload.start_date,
        end_date=payload.end_date,
        capacity_points=payload.capacity_points,
    )
    db.add(sprint)
    await db.flush()
    await db.refresh(sprint)
    return sprint


# ---------------------------------------------------------------------------
# 13. PUT /projects/{project_id}/sprints/{sprint_id}  â€” update sprint
# ---------------------------------------------------------------------------


@router.put(
    "/{project_id}/sprints/{sprint_id}",
    response_model=schemas.SprintResponse,
)
async def update_sprint(
    project_id: str,
    sprint_id: str,
    payload: schemas.SprintUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update fields on a sprint."""
    await _get_project_or_404(project_id, db, current_user.org_id)
    sprint = await _get_sprint_or_404(sprint_id, project_id, db)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(sprint, field, value)

    await db.flush()
    await db.refresh(sprint)
    return sprint


# ---------------------------------------------------------------------------
# 14. POST /projects/{project_id}/sprints/plan  â€” AI sprint planning
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/sprints/plan",
    response_model=schemas.MessageResponse,
)
async def plan_sprint(
    project_id: str,
    payload: schemas.SprintPlanRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Use AI to plan the next sprint.

    Fetches unassigned backlog items, calls the AI sprint planner, and returns
    the recommended plan.
    """
    await _get_project_or_404(project_id, db, current_user.org_id)

    # Fetch backlog items not yet assigned to any sprint
    result = await db.execute(
        select(models.BacklogItem).where(
            models.BacklogItem.project_id == project_id,
            models.BacklogItem.sprint_id.is_(None),
            models.BacklogItem.status == "backlog",
        )
    )
    unassigned_items = result.scalars().all()

    items_as_list = [
        {
            "id": item.id,
            "title": item.title,
            "description": item.description,
            "priority": item.priority,
            "story_points": item.story_points,
            "status": item.status,
        }
        for item in unassigned_items
    ]

    plan = await ai_client.plan_sprint(
        items_as_list,
        velocity=payload.velocity,
        capacity=payload.capacity,
    )

    return schemas.MessageResponse(
        message="Sprint plan generated successfully.",
        data=plan,
    )


# ===========================================================================
# Traceability Matrix
# ===========================================================================


# ---------------------------------------------------------------------------
# 15. GET /projects/{project_id}/traceability  â€” traceability matrix
# ---------------------------------------------------------------------------


@router.get("/{project_id}/traceability")
async def get_traceability_matrix(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    """
    Return the full traceability matrix for a project.

    For each requirement, lists its linked backlog items, AI jobs,
    and test cases.
    """
    org_id = _demo_org_id(current_user)
    await _get_project_or_404(project_id, db, org_id)

    # Fetch requirements with their related entities in one round-trip
    req_result = await db.execute(
        select(models.Requirement)
        .where(models.Requirement.project_id == project_id)
        .options(
            selectinload(models.Requirement.backlog_items),
            selectinload(models.Requirement.ai_jobs),
            selectinload(models.Requirement.test_cases),
        )
        .order_by(models.Requirement.created_at.asc())
    )
    requirements = req_result.scalars().all()

    matrix = []
    for req in requirements:
        matrix.append(
            {
                "requirement": {
                    "id": req.id,
                    "title": req.title,
                    "description": req.description,
                    "priority": req.priority,
                    "status": req.status,
                    "version": req.version,
                    "ai_generated": req.ai_generated,
                    "created_at": req.created_at.isoformat(),
                },
                "backlog_items": [
                    {
                        "id": bi.id,
                        "title": bi.title,
                        "status": bi.status,
                        "priority": bi.priority,
                        "story_points": bi.story_points,
                        "sprint_id": bi.sprint_id,
                    }
                    for bi in req.backlog_items
                ],
                "ai_jobs": [
                    {
                        "id": job.id,
                        "engine": job.engine,
                        "status": job.status,
                        "trigger_source": job.trigger_source,
                        "created_at": job.created_at.isoformat(),
                    }
                    for job in req.ai_jobs
                ],
                "test_cases": [
                    {
                        "id": tc.id,
                        "title": tc.title,
                        "type": tc.type,
                        "ai_generated": tc.ai_generated,
                        "created_at": tc.created_at.isoformat(),
                    }
                    for tc in req.test_cases
                ],
            }
        )

    return {"requirements": matrix}

