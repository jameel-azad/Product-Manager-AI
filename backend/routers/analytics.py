"""
Xccelera AI-SDLC Platform — Analytics & KPIs router.

Provides endpoints for project dashboards, KPI computation, sprint velocity,
burndown charts, AI productivity metrics, deployment history, platform summary,
and SDLC phase progress.

MEE references: MEE-003 (KPIs), MEE-006 (AI vs human productivity).
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_optional_user
from database import get_db
from models import (
    AIJob,
    BacklogItem,
    Deployment,
    DesignArtifact,
    MEEEvent,
    Organization,
    Project,
    Requirement,
    Sprint,
    TestRun,
    User,
)
from schemas import (
    AIJobResponse,
    DashboardResponse,
    DeploymentResponse,
    KPIResponse,
    ProjectResponse,
)

router = APIRouter(prefix="/analytics", tags=["Analytics & KPIs"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_project_or_404(project_id: str, db: AsyncSession) -> Project:
    """Fetch a project by ID or raise HTTP 404."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id!r} not found",
        )
    return project


async def _compute_kpis(project_id: str, db: AsyncSession) -> KPIResponse:
    """Compute all KPI values for a project from the database."""

    # Requirements counts
    total_req_result = await db.execute(
        select(func.count(Requirement.id)).where(
            Requirement.project_id == project_id
        )
    )
    total_requirements: int = total_req_result.scalar_one() or 0

    completed_req_result = await db.execute(
        select(func.count(Requirement.id)).where(
            and_(
                Requirement.project_id == project_id,
                Requirement.status == "approved",
            )
        )
    )
    completed_requirements: int = completed_req_result.scalar_one() or 0

    # Backlog counts
    total_backlog_result = await db.execute(
        select(func.count(BacklogItem.id)).where(
            BacklogItem.project_id == project_id
        )
    )
    total_backlog: int = total_backlog_result.scalar_one() or 0

    completed_backlog_result = await db.execute(
        select(func.count(BacklogItem.id)).where(
            and_(
                BacklogItem.project_id == project_id,
                BacklogItem.status == "done",
            )
        )
    )
    completed_backlog: int = completed_backlog_result.scalar_one() or 0

    # AI job counts
    total_jobs_result = await db.execute(
        select(func.count(AIJob.id)).where(AIJob.project_id == project_id)
    )
    total_ai_jobs: int = total_jobs_result.scalar_one() or 0

    completed_jobs_result = await db.execute(
        select(func.count(AIJob.id)).where(
            and_(
                AIJob.project_id == project_id,
                AIJob.status == "completed",
            )
        )
    )
    completed_ai_jobs: int = completed_jobs_result.scalar_one() or 0

    # Test coverage — most recent completed test run
    latest_run_result = await db.execute(
        select(TestRun.coverage_pct)
        .where(
            and_(
                TestRun.project_id == project_id,
                TestRun.status == "completed",
                TestRun.coverage_pct.is_not(None),
            )
        )
        .order_by(TestRun.created_at.desc())
        .limit(1)
    )
    coverage_row = latest_run_result.scalar_one_or_none()
    test_coverage: float = coverage_row if coverage_row is not None else 0.0

    # Deployment count
    deploy_count_result = await db.execute(
        select(func.count(Deployment.id)).where(
            Deployment.project_id == project_id
        )
    )
    deployment_count: int = deploy_count_result.scalar_one() or 0

    # Sprint velocity — average story_points of completed backlog items per sprint
    # Fetch distinct sprint IDs that have at least one completed item
    sprints_result = await db.execute(
        select(BacklogItem.sprint_id, func.sum(BacklogItem.story_points))
        .where(
            and_(
                BacklogItem.project_id == project_id,
                BacklogItem.status == "done",
                BacklogItem.sprint_id.is_not(None),
                BacklogItem.story_points.is_not(None),
            )
        )
        .group_by(BacklogItem.sprint_id)
    )
    sprint_rows = sprints_result.all()
    if sprint_rows:
        total_points = sum(row[1] or 0 for row in sprint_rows)
        sprint_velocity = int(total_points / len(sprint_rows))
    else:
        sprint_velocity = 0

    return KPIResponse(
        project_id=project_id,
        total_requirements=total_requirements,
        completed_requirements=completed_requirements,
        total_backlog=total_backlog,
        completed_backlog=completed_backlog,
        total_ai_jobs=total_ai_jobs,
        completed_ai_jobs=completed_ai_jobs,
        test_coverage=test_coverage,
        deployment_count=deployment_count,
        sprint_velocity=sprint_velocity,
    )


# ---------------------------------------------------------------------------
# 1. Dashboard
# ---------------------------------------------------------------------------


@router.get(
    "/dashboard/{project_id}",
    response_model=DashboardResponse,
    summary="Full analytics dashboard for a project",
)
async def get_dashboard(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> DashboardResponse:
    """
    Return a complete analytics dashboard including project details, KPIs,
    the 5 most-recent AI jobs, and the 5 most-recent deployments.
    """
    project = await _get_project_or_404(project_id, db)
    kpis = await _compute_kpis(project_id, db)

    recent_jobs_result = await db.execute(
        select(AIJob)
        .where(AIJob.project_id == project_id)
        .order_by(AIJob.created_at.desc())
        .limit(5)
    )
    recent_jobs = recent_jobs_result.scalars().all()

    recent_deploys_result = await db.execute(
        select(Deployment)
        .where(Deployment.project_id == project_id)
        .order_by(Deployment.created_at.desc())
        .limit(5)
    )
    recent_deployments = recent_deploys_result.scalars().all()

    return DashboardResponse(
        project=ProjectResponse.model_validate(project),
        kpis=kpis,
        recent_jobs=[AIJobResponse.model_validate(j) for j in recent_jobs],
        recent_deployments=[DeploymentResponse.model_validate(d) for d in recent_deployments],
    )


# ---------------------------------------------------------------------------
# 2. KPIs
# ---------------------------------------------------------------------------


@router.get(
    "/kpis/{project_id}",
    response_model=KPIResponse,
    summary="Project KPIs (MEE-003)",
)
async def get_kpis(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> KPIResponse:
    """
    Compute and return KPI metrics for the given project:
    requirement counts, backlog progress, AI job completion, test coverage,
    deployment count, and sprint velocity.
    """
    await _get_project_or_404(project_id, db)
    return await _compute_kpis(project_id, db)


# ---------------------------------------------------------------------------
# 3. Velocity
# ---------------------------------------------------------------------------


@router.get(
    "/velocity/{project_id}",
    summary="Sprint velocity chart data",
)
async def get_velocity(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> Dict[str, Any]:
    """
    Return per-sprint completed and planned story-point totals for the
    sprint velocity chart.
    """
    await _get_project_or_404(project_id, db)

    # Fetch all sprints ordered chronologically
    sprints_result = await db.execute(
        select(Sprint)
        .where(Sprint.project_id == project_id)
        .order_by(Sprint.start_date.asc().nullslast(), Sprint.created_at.asc())
    )
    sprints: List[Sprint] = sprints_result.scalars().all()

    sprint_data: List[Dict[str, Any]] = []
    for sprint in sprints:
        # Completed points for this sprint
        completed_result = await db.execute(
            select(func.sum(BacklogItem.story_points)).where(
                and_(
                    BacklogItem.project_id == project_id,
                    BacklogItem.sprint_id == sprint.id,
                    BacklogItem.status == "done",
                    BacklogItem.story_points.is_not(None),
                )
            )
        )
        completed_points: int = completed_result.scalar_one() or 0

        # Planned points == sprint capacity or sum of all items in sprint
        planned_points: int = sprint.capacity_points or 0
        if planned_points == 0:
            all_points_result = await db.execute(
                select(func.sum(BacklogItem.story_points)).where(
                    and_(
                        BacklogItem.project_id == project_id,
                        BacklogItem.sprint_id == sprint.id,
                        BacklogItem.story_points.is_not(None),
                    )
                )
            )
            planned_points = all_points_result.scalar_one() or 0

        sprint_data.append(
            {
                "name": sprint.name,
                "completed_points": completed_points,
                "planned_points": planned_points,
                "date": sprint.start_date.isoformat() if sprint.start_date else None,
            }
        )

    return {"sprints": sprint_data}


# ---------------------------------------------------------------------------
# 4. Burndown
# ---------------------------------------------------------------------------


@router.get(
    "/burndown/{sprint_id}",
    summary="Sprint burndown chart (ideal vs actual)",
)
async def get_burndown(
    sprint_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> Dict[str, Any]:
    """
    Return ideal and actual burndown series for a sprint.

    When the sprint has defined start/end dates the ideal line is computed
    from those dates; otherwise a 14-day default is assumed.  The actual
    series is generated from the story-points of backlog items completed
    within the sprint window.
    """
    sprint_result = await db.execute(select(Sprint).where(Sprint.id == sprint_id))
    sprint: Optional[Sprint] = sprint_result.scalar_one_or_none()
    if sprint is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sprint {sprint_id!r} not found",
        )

    # Determine sprint window
    start: datetime = sprint.start_date or datetime.utcnow() - timedelta(days=14)
    end: datetime = sprint.end_date or start + timedelta(days=14)
    total_days: int = max((end - start).days, 1)

    # Total planned points
    total_points_result = await db.execute(
        select(func.sum(BacklogItem.story_points)).where(
            and_(
                BacklogItem.project_id == sprint.project_id,
                BacklogItem.sprint_id == sprint_id,
                BacklogItem.story_points.is_not(None),
            )
        )
    )
    total_points: int = total_points_result.scalar_one() or 0

    # Use capacity if set and larger
    if sprint.capacity_points and sprint.capacity_points > total_points:
        total_points = sprint.capacity_points

    # Ideal burndown: linear from total_points down to 0
    ideal: List[Dict[str, Any]] = [
        {
            "day": day,
            "points": round(total_points * (1 - day / total_days)),
        }
        for day in range(total_days + 1)
    ]

    # Actual burndown: based on completed items and their updated_at timestamp
    completed_items_result = await db.execute(
        select(BacklogItem).where(
            and_(
                BacklogItem.project_id == sprint.project_id,
                BacklogItem.sprint_id == sprint_id,
                BacklogItem.status == "done",
                BacklogItem.story_points.is_not(None),
            )
        ).order_by(BacklogItem.updated_at.asc())
    )
    completed_items: List[BacklogItem] = completed_items_result.scalars().all()

    # Build a per-day remaining-points map
    remaining_by_day: Dict[int, int] = {}
    burned: int = 0
    for item in completed_items:
        completion_ts = item.updated_at
        if completion_ts < start:
            day_idx = 0
        else:
            day_idx = min((completion_ts - start).days, total_days)
        burned += item.story_points or 0
        remaining_by_day[day_idx] = total_points - burned

    # Fill forward
    actual: List[Dict[str, Any]] = []
    last_remaining: int = total_points
    today_day: int = min((datetime.utcnow() - start).days, total_days)
    for day in range(total_days + 1):
        if day in remaining_by_day:
            last_remaining = remaining_by_day[day]
        if day <= today_day:
            actual.append({"day": day, "points": last_remaining})

    return {
        "sprint_name": sprint.name,
        "ideal": ideal,
        "actual": actual,
    }


# ---------------------------------------------------------------------------
# 5. AI Productivity
# ---------------------------------------------------------------------------


@router.get(
    "/ai-productivity/{project_id}",
    summary="AI vs human productivity (MEE-006)",
)
async def get_ai_productivity(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> Dict[str, Any]:
    """
    Aggregate AI-generated artefacts vs manually-created ones over time and
    return a timeline suitable for charting alongside overall efficiency gain.
    """
    await _get_project_or_404(project_id, db)

    # Fetch completed AI jobs ordered by completion date
    ai_jobs_result = await db.execute(
        select(AIJob).where(
            and_(
                AIJob.project_id == project_id,
                AIJob.status == "completed",
                AIJob.completed_at.is_not(None),
            )
        ).order_by(AIJob.completed_at.asc())
    )
    ai_jobs: List[AIJob] = ai_jobs_result.scalars().all()

    # Fetch manually-created (non-AI-generated) backlog items per day
    manual_items_result = await db.execute(
        select(BacklogItem).where(
            and_(
                BacklogItem.project_id == project_id,
                BacklogItem.ai_generated == False,  # noqa: E712
            )
        ).order_by(BacklogItem.created_at.asc())
    )
    manual_items: List[BacklogItem] = manual_items_result.scalars().all()

    # Build daily buckets
    daily_ai: Dict[str, int] = {}
    for job in ai_jobs:
        day_key = job.completed_at.strftime("%Y-%m-%d")  # type: ignore[union-attr]
        daily_ai[day_key] = daily_ai.get(day_key, 0) + 1

    daily_human: Dict[str, int] = {}
    for item in manual_items:
        day_key = item.created_at.strftime("%Y-%m-%d")
        daily_human[day_key] = daily_human.get(day_key, 0) + 1

    all_days = sorted(set(list(daily_ai.keys()) + list(daily_human.keys())))
    timeline: List[Dict[str, Any]] = [
        {
            "date": day,
            "ai_output": daily_ai.get(day, 0),
            "human_output": daily_human.get(day, 0),
        }
        for day in all_days
    ]

    total_ai: int = len(ai_jobs)
    total_human: int = len(manual_items)

    if total_human > 0:
        raw_ratio = total_ai / total_human
    else:
        raw_ratio = float(total_ai) if total_ai > 0 else 1.0

    efficiency_gain = f"{raw_ratio:.1f}x"

    return {
        "timeline": timeline,
        "totals": {"ai": total_ai, "human": total_human},
        "efficiency_gain": efficiency_gain,
    }


# ---------------------------------------------------------------------------
# 6. Deployment History
# ---------------------------------------------------------------------------


@router.get(
    "/deployment-history/{project_id}",
    summary="Deployment frequency and history",
)
async def get_deployment_history(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> Dict[str, Any]:
    """
    Return all deployments for a project together with the computed deployment
    frequency (deployments per week) and success rate.
    """
    await _get_project_or_404(project_id, db)

    deploys_result = await db.execute(
        select(Deployment)
        .where(Deployment.project_id == project_id)
        .order_by(Deployment.created_at.desc())
    )
    deployments: List[Deployment] = deploys_result.scalars().all()

    total = len(deployments)
    succeeded = sum(1 for d in deployments if d.status in ("success", "succeeded", "completed"))
    success_rate: float = round(succeeded / total, 2) if total > 0 else 0.0

    # Frequency: deployments per week based on date range of all deployments
    if total >= 2:
        oldest = min(d.created_at for d in deployments)
        newest = max(d.created_at for d in deployments)
        weeks = max((newest - oldest).days / 7, 1)
        freq_val = round(total / weeks, 1)
        frequency = f"{freq_val} per week"
    elif total == 1:
        frequency = "1 per week"
    else:
        frequency = "0 per week"

    return {
        "deployments": [DeploymentResponse.model_validate(d) for d in deployments],
        "frequency": frequency,
        "success_rate": success_rate,
    }


# ---------------------------------------------------------------------------
# 7. Platform Summary
# ---------------------------------------------------------------------------


@router.get(
    "/platform-summary",
    summary="Overall platform summary (main dashboard)",
)
async def get_platform_summary(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> Dict[str, Any]:
    """
    Return platform-wide aggregate counts: total projects, users, AI jobs,
    requirements, and recent deployments (last 10).
    """
    total_projects_result = await db.execute(select(func.count(Project.id)))
    total_projects: int = total_projects_result.scalar_one() or 0

    total_users_result = await db.execute(select(func.count(User.id)))
    total_users: int = total_users_result.scalar_one() or 0

    total_ai_jobs_result = await db.execute(select(func.count(AIJob.id)))
    total_ai_jobs: int = total_ai_jobs_result.scalar_one() or 0

    total_requirements_result = await db.execute(select(func.count(Requirement.id)))
    total_requirements: int = total_requirements_result.scalar_one() or 0

    recent_deploys_result = await db.execute(
        select(Deployment)
        .order_by(Deployment.created_at.desc())
        .limit(10)
    )
    recent_deployments: List[Deployment] = recent_deploys_result.scalars().all()

    return {
        "total_projects": total_projects,
        "total_users": total_users,
        "total_ai_jobs": total_ai_jobs,
        "total_requirements": total_requirements,
        "recent_deployments": [
            DeploymentResponse.model_validate(d) for d in recent_deployments
        ],
    }


# ---------------------------------------------------------------------------
# 8. SDLC Phase Progress
# ---------------------------------------------------------------------------


@router.get(
    "/sdlc-progress/{project_id}",
    summary="SDLC phase completion progress",
)
async def get_sdlc_progress(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> Dict[str, Any]:
    """
    Return per-phase SDLC progress for a project.

    Each phase reports:
    - ``name``: phase label
    - ``status``: ``"completed"`` | ``"in_progress"`` | ``"not_started"``
    - ``completion_pct``: 0–100
    - ``items_count``: number of relevant records found
    """
    await _get_project_or_404(project_id, db)

    phases: List[Dict[str, Any]] = []

    # --- Planning: any requirements exist? ---
    req_count_result = await db.execute(
        select(func.count(Requirement.id)).where(
            Requirement.project_id == project_id
        )
    )
    req_count: int = req_count_result.scalar_one() or 0
    phases.append(
        _phase_entry("Planning", req_count, threshold=1)
    )

    # --- Requirements: approved requirements? ---
    approved_req_result = await db.execute(
        select(func.count(Requirement.id)).where(
            and_(
                Requirement.project_id == project_id,
                Requirement.status == "approved",
            )
        )
    )
    approved_req: int = approved_req_result.scalar_one() or 0
    phases.append(
        _phase_entry("Requirements", approved_req, threshold=1, total=req_count or 1)
    )

    # --- Design: design artifacts? ---
    design_count_result = await db.execute(
        select(func.count(DesignArtifact.id)).where(
            DesignArtifact.project_id == project_id
        )
    )
    design_count: int = design_count_result.scalar_one() or 0
    phases.append(
        _phase_entry("Design", design_count, threshold=1)
    )

    # --- Development: completed AI jobs? ---
    completed_jobs_result = await db.execute(
        select(func.count(AIJob.id)).where(
            and_(
                AIJob.project_id == project_id,
                AIJob.status == "completed",
            )
        )
    )
    completed_jobs: int = completed_jobs_result.scalar_one() or 0
    total_jobs_result = await db.execute(
        select(func.count(AIJob.id)).where(AIJob.project_id == project_id)
    )
    total_jobs: int = total_jobs_result.scalar_one() or 0
    phases.append(
        _phase_entry("Development", completed_jobs, threshold=1, total=total_jobs or 1)
    )

    # --- Testing: test runs exist? ---
    test_run_count_result = await db.execute(
        select(func.count(TestRun.id)).where(TestRun.project_id == project_id)
    )
    test_run_count: int = test_run_count_result.scalar_one() or 0
    phases.append(
        _phase_entry("Testing", test_run_count, threshold=1)
    )

    # --- Deployment: deployments exist? ---
    deploy_count_result = await db.execute(
        select(func.count(Deployment.id)).where(
            Deployment.project_id == project_id
        )
    )
    deploy_count: int = deploy_count_result.scalar_one() or 0
    phases.append(
        _phase_entry("Deployment", deploy_count, threshold=1)
    )

    # --- Monitoring: MEE events for this project? ---
    mee_count_result = await db.execute(
        select(func.count(MEEEvent.id)).where(
            MEEEvent.project_id == project_id
        )
    )
    mee_count: int = mee_count_result.scalar_one() or 0
    phases.append(
        _phase_entry("Monitoring", mee_count, threshold=1)
    )

    return {"phases": phases}


def _phase_entry(
    name: str,
    items_count: int,
    *,
    threshold: int = 1,
    total: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Build a SDLC phase dict.

    ``total`` is used to calculate completion_pct as a ratio; when omitted the
    phase is either 0 % or 100 % based on whether items_count >= threshold.
    """
    if items_count == 0:
        pct = 0
        phase_status = "not_started"
    elif total is not None:
        pct = min(100, int(items_count / total * 100))
        phase_status = "completed" if pct >= 100 else "in_progress"
    else:
        pct = 100 if items_count >= threshold else 0
        phase_status = "completed" if items_count >= threshold else "not_started"

    return {
        "name": name,
        "status": phase_status,
        "completion_pct": pct,
        "items_count": items_count,
    }
