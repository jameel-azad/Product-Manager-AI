"""
Xccelera AI-SDLC Platform â€” AI Orchestration Router.

Covers all eight AI engines:
  APIX-001  â€” Backend code generation (APIx)
  UIX-001   â€” Frontend generation (UIx)
  INTX-001  â€” Integration binding (IntegrationX)
  MOB-001   â€” Mobile app generation (Mobile AI)
  AGT-002   â€” Autonomous agent developer (AgentDeveloper)
  LCC-002   â€” Legacy code conversion (LegacyConverter)
  BEX-001   â€” Business logic extraction (BusinessExtractor)
  (inline)  â€” Integration glue-code via direct Claude call

All trigger endpoints follow the same lifecycle pattern:
  1. Create AIJob(status='queued') â€” return immediately visible record.
  2. Transition to 'running', invoke the relevant ai_client function.
  3. Transition to 'completed' with result payload.
  4. On any exception: transition to 'failed' and record error_message.

MEEEvents are written before and after each AI execution to the
Meta-Event Engine so other services can react to job state changes.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

import ai_client
from auth import get_current_user
from database import get_db
from models import AIJob, MEEEvent, Project, Requirement, User
from schemas import AIJobResponse, MessageResponse, TriggerRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Orchestration"])


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _get_project_or_404(project_id: str, db: AsyncSession) -> Project:
    """Fetch a Project by PK; raise 404 if missing."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found.",
        )
    return project


async def _get_job_or_404(job_id: str, db: AsyncSession) -> AIJob:
    """Fetch an AIJob by PK; raise 404 if missing."""
    result = await db.execute(select(AIJob).where(AIJob.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AI job '{job_id}' not found.",
        )
    return job


async def _create_mee_event(
    *,
    db: AsyncSession,
    org_id: str,
    project_id: str,
    engine: str,
    event_type: str,
    description: str,
    event_metadata: Dict[str, Any],
    severity: str = "info",
) -> None:
    """Persist a MEEEvent without committing (caller owns the transaction)."""
    event = MEEEvent(
        org_id=org_id,
        project_id=project_id,
        engine=engine,
        event_type=event_type,
        description=description,
        event_metadata=event_metadata,
        severity=severity,
    )
    db.add(event)


async def _create_job(
    *,
    db: AsyncSession,
    org_id: str,
    project_id: str,
    requirement_id: Optional[str],
    engine: str,
    trigger_source: str,
    payload: Dict[str, Any],
    priority: str = "medium",
) -> AIJob:
    """
    Create and persist an AIJob with status='queued'.

    The caller must commit (or rely on FastAPI's get_db auto-commit) after
    the full lifecycle is complete.
    """
    job = AIJob(
        org_id=org_id,
        project_id=project_id,
        requirement_id=requirement_id,
        engine=engine,
        trigger_source=trigger_source,
        priority=priority,
        status="queued",
        payload=payload,
    )
    db.add(job)
    await db.flush()  # populate job.id before returning
    return job


async def _mark_running(job: AIJob, db: AsyncSession) -> None:
    """Transition job to 'running' and record start time."""
    job.status = "running"
    job.started_at = datetime.utcnow()
    job.attempt_count += 1
    db.add(job)
    await db.flush()


async def _mark_completed(
    job: AIJob, result: Dict[str, Any], db: AsyncSession
) -> None:
    """Transition job to 'completed' and store result."""
    job.status = "completed"
    job.result = result
    job.completed_at = datetime.utcnow()
    db.add(job)
    await db.flush()


async def _mark_failed(job: AIJob, error: str, db: AsyncSession) -> None:
    """Transition job to 'failed' and store error message."""
    job.status = "failed"
    job.error_message = error
    job.completed_at = datetime.utcnow()
    db.add(job)
    await db.flush()


# ---------------------------------------------------------------------------
# Generic trigger executor
# ---------------------------------------------------------------------------


async def _execute_trigger(
    *,
    db: AsyncSession,
    current_user: User,
    body: TriggerRequest,
    engine: str,
    trigger_source: str,
    ai_callable,          # async callable that returns the AI result
    result_key: str = "output",
    priority: str = "medium",
) -> AIJobResponse:
    """
    Reusable trigger lifecycle:
      queued -> running -> completed | failed
    with MEEEvents bracketing execution.
    """
    project = await _get_project_or_404(body.project_id, db)

    # Optionally validate requirement_id
    if body.requirement_id:
        req_result = await db.execute(
            select(Requirement).where(Requirement.id == body.requirement_id)
        )
        if req_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Requirement '{body.requirement_id}' not found.",
            )

    # 1. Create queued job
    job = await _create_job(
        db=db,
        org_id=project.org_id,
        project_id=project.id,
        requirement_id=body.requirement_id,
        engine=engine,
        trigger_source=trigger_source,
        payload=body.payload,
        priority=priority,
    )

    # 2. MEEEvent â€” job queued
    await _create_mee_event(
        db=db,
        org_id=project.org_id,
        project_id=project.id,
        engine=engine,
        event_type="job_queued",
        description=f"{engine} job {job.id} queued for project {project.id}.",
        event_metadata={"job_id": job.id, "trigger_source": trigger_source},
    )

    try:
        # 3. Transition to running
        await _mark_running(job, db)

        # 4. MEEEvent â€” execution started
        await _create_mee_event(
            db=db,
            org_id=project.org_id,
            project_id=project.id,
            engine=engine,
            event_type="job_started",
            description=f"{engine} job {job.id} execution started.",
            event_metadata={"job_id": job.id},
        )

        # 5. Invoke AI
        ai_result = await ai_callable()

        # 6. Transition to completed
        result_payload: Dict[str, Any] = {result_key: ai_result}
        await _mark_completed(job, result_payload, db)

        # 7. MEEEvent â€” execution completed
        await _create_mee_event(
            db=db,
            org_id=project.org_id,
            project_id=project.id,
            engine=engine,
            event_type="job_completed",
            description=f"{engine} job {job.id} completed successfully.",
            event_metadata={"job_id": job.id, "result_key": result_key},
        )

    except Exception as exc:
        logger.error("[%s] job %s failed: %s", engine, job.id, exc, exc_info=True)
        await _mark_failed(job, str(exc), db)

        # MEEEvent â€” failure
        await _create_mee_event(
            db=db,
            org_id=project.org_id,
            project_id=project.id,
            engine=engine,
            event_type="job_failed",
            description=f"{engine} job {job.id} failed: {exc}",
            event_metadata={"job_id": job.id, "error": str(exc)},
            severity="error",
        )

    return AIJobResponse.model_validate(job)


# ===========================================================================
# 1. GET /ai/jobs â€” List AI jobs
# ===========================================================================


@router.get(
    "/jobs",
    response_model=List[AIJobResponse],
    summary="List AI jobs",
    description="Return AI jobs filtered by project, status, and/or engine.",
)
async def list_jobs(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    status: Optional[str] = Query(None, description="Filter by job status"),
    engine: Optional[str] = Query(None, description="Filter by engine name"),
    limit: int = Query(50, ge=1, le=500, description="Maximum results to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[AIJobResponse]:
    query = select(AIJob).where(AIJob.org_id == current_user.org_id)

    if project_id:
        query = query.where(AIJob.project_id == project_id)
    if status:
        query = query.where(AIJob.status == status)
    if engine:
        query = query.where(AIJob.engine == engine)

    query = query.order_by(AIJob.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    jobs = result.scalars().all()
    return [AIJobResponse.model_validate(j) for j in jobs]


# ===========================================================================
# 2. GET /ai/jobs/{job_id} â€” Get a single job
# ===========================================================================


@router.get(
    "/jobs/{job_id}",
    response_model=AIJobResponse,
    summary="Get AI job",
    description="Retrieve a single AI job by its ID.",
)
async def get_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AIJobResponse:
    job = await _get_job_or_404(job_id, db)
    if job.org_id != current_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied.",
        )
    return AIJobResponse.model_validate(job)


# ===========================================================================
# 3. DELETE /ai/jobs/{job_id} â€” Cancel a job
# ===========================================================================


@router.delete(
    "/jobs/{job_id}",
    response_model=MessageResponse,
    summary="Cancel AI job",
    description="Cancel a queued or running AI job by setting its status to 'cancelled'.",
)
async def cancel_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    job = await _get_job_or_404(job_id, db)
    if job.org_id != current_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied.",
        )
    if job.status in ("completed", "failed", "cancelled"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Job is already in terminal state '{job.status}'.",
        )

    job.status = "cancelled"
    job.completed_at = datetime.utcnow()
    db.add(job)

    # MEEEvent â€” cancellation
    await _create_mee_event(
        db=db,
        org_id=job.org_id,
        project_id=job.project_id,
        engine=job.engine,
        event_type="job_cancelled",
        description=f"Job {job.id} cancelled by user {current_user.id}.",
        event_metadata={"job_id": job.id, "cancelled_by": current_user.id},
        severity="warning",
    )

    return MessageResponse(message=f"Job '{job_id}' has been cancelled.")


# ===========================================================================
# 4. POST /ai/apix/trigger â€” APIX-001  Backend code generation
# ===========================================================================


@router.post(
    "/apix/trigger",
    response_model=AIJobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="APIX-001: Trigger backend code generation",
    description=(
        "Trigger the APIx engine to generate backend Python/FastAPI source code "
        "from a requirement description."
    ),
)
async def trigger_apix(
    body: TriggerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AIJobResponse:
    requirement_desc = body.payload.get(
        "description",
        "Generate a Python FastAPI CRUD service with full endpoint coverage.",
    )
    tech_stack = body.payload.get("tech_stack", "Python/FastAPI")

    async def _ai():
        return await ai_client.generate_code(
            requirement=requirement_desc,
            tech_stack=tech_stack,
            engine="apix",
        )

    return await _execute_trigger(
        db=db,
        current_user=current_user,
        body=body,
        engine="apix",
        trigger_source="APIX-001",
        ai_callable=_ai,
        result_key="code",
    )


# ===========================================================================
# 5. POST /ai/uix/trigger â€” UIX-001  Frontend generation
# ===========================================================================


@router.post(
    "/uix/trigger",
    response_model=AIJobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="UIX-001: Trigger frontend code generation",
    description=(
        "Trigger the UIx engine to generate a React/TypeScript frontend component "
        "from a requirement description."
    ),
)
async def trigger_uix(
    body: TriggerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AIJobResponse:
    requirement_desc = body.payload.get(
        "description",
        "Generate a responsive React TypeScript UI component with Tailwind CSS.",
    )
    tech_stack = body.payload.get("tech_stack", "React/TypeScript/Tailwind")

    async def _ai():
        return await ai_client.generate_code(
            requirement=requirement_desc,
            tech_stack=tech_stack,
            engine="uix",
        )

    return await _execute_trigger(
        db=db,
        current_user=current_user,
        body=body,
        engine="uix",
        trigger_source="UIX-001",
        ai_callable=_ai,
        result_key="code",
    )


# ===========================================================================
# 6. POST /ai/integrationx/trigger â€” INTX-001  Integration binding
# ===========================================================================


@router.post(
    "/integrationx/trigger",
    response_model=AIJobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="INTX-001: Trigger integration binding",
    description=(
        "Trigger the IntegrationX engine to generate glue code that connects an "
        "APIx backend job and a UIx frontend job. Supply apix_job_id and uix_job_id "
        "inside the payload."
    ),
)
async def trigger_integrationx(
    body: TriggerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AIJobResponse:
    apix_job_id: Optional[str] = body.payload.get("apix_job_id")
    uix_job_id: Optional[str] = body.payload.get("uix_job_id")

    # Resolve backend and frontend code from existing jobs (best-effort)
    backend_code: str = "# backend code not found"
    frontend_code: str = "// frontend code not found"

    if apix_job_id:
        apix_result = await db.execute(select(AIJob).where(AIJob.id == apix_job_id))
        apix_job = apix_result.scalar_one_or_none()
        if apix_job and apix_job.result:
            backend_code = apix_job.result.get("code", backend_code)

    if uix_job_id:
        uix_result = await db.execute(select(AIJob).where(AIJob.id == uix_job_id))
        uix_job_obj = uix_result.scalar_one_or_none()
        if uix_job_obj and uix_job_obj.result:
            frontend_code = uix_job_obj.result.get("code", frontend_code)

    async def _ai():
        # Inline Claude call: generate integration glue code
        system_prompt = (
            "You are an expert full-stack integration engineer. "
            "Given a FastAPI backend and a React frontend, generate the minimal "
            "integration glue: API client functions, hooks, and any shared types. "
            "Output ONLY raw TypeScript/Python code with concise comments."
        )
        user_prompt = (
            f"Backend (FastAPI):\n```python\n{backend_code[:3000]}\n```\n\n"
            f"Frontend (React/TypeScript):\n```typescript\n{frontend_code[:3000]}\n```\n\n"
            "Generate integration glue code (API client + React hook) that connects "
            "these two layers. Include proper TypeScript types and error handling."
        )
        raw = await ai_client._call(system_prompt, user_prompt)
        return raw.strip()

    return await _execute_trigger(
        db=db,
        current_user=current_user,
        body=body,
        engine="integrationx",
        trigger_source="INTX-001",
        ai_callable=_ai,
        result_key="glue_code",
    )


# ===========================================================================
# 7. POST /ai/mobile/trigger â€” MOB-001  Mobile app generation
# ===========================================================================


@router.post(
    "/mobile/trigger",
    response_model=AIJobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="MOB-001: Trigger mobile app generation",
    description=(
        "Trigger the Mobile AI engine to generate a React Native component or "
        "screen from a requirement description."
    ),
)
async def trigger_mobile(
    body: TriggerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AIJobResponse:
    requirement_desc = body.payload.get(
        "description",
        "Generate a React Native mobile screen with navigation and data fetching.",
    )
    tech_stack = body.payload.get("tech_stack", "React Native/TypeScript/Expo")

    async def _ai():
        return await ai_client.generate_code(
            requirement=requirement_desc,
            tech_stack=tech_stack,
            engine="mobile_ai",
        )

    return await _execute_trigger(
        db=db,
        current_user=current_user,
        body=body,
        engine="mobile_ai",
        trigger_source="MOB-001",
        ai_callable=_ai,
        result_key="code",
    )


# ===========================================================================
# 8. POST /ai/agent-developer/trigger â€” AGT-002  Agent developer
# ===========================================================================


@router.post(
    "/agent-developer/trigger",
    response_model=AIJobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="AGT-002: Trigger agent developer",
    description=(
        "Trigger the AgentDeveloper engine to scaffold and generate an autonomous "
        "agent definition from a specification."
    ),
)
async def trigger_agent_developer(
    body: TriggerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AIJobResponse:
    spec = body.payload.get(
        "spec",
        "Create a general-purpose AI agent capable of requirement analysis and "
        "code generation.",
    )
    template = body.payload.get("template", "general")

    async def _ai():
        return await ai_client.generate_agent(spec=spec, template=template)

    return await _execute_trigger(
        db=db,
        current_user=current_user,
        body=body,
        engine="agent_developer",
        trigger_source="AGT-002",
        ai_callable=_ai,
        result_key="agent",
    )


# ===========================================================================
# 9. POST /ai/legacy/trigger â€” LCC-002  Legacy code conversion
# ===========================================================================


@router.post(
    "/legacy/trigger",
    response_model=AIJobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="LCC-002: Trigger legacy code conversion",
    description=(
        "Trigger the LegacyConverter engine to modernise source code from one "
        "language to another. Provide source_code, source_language, and "
        "target_language in the payload."
    ),
)
async def trigger_legacy(
    body: TriggerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AIJobResponse:
    source_code = body.payload.get("source_code", "")
    source_lang = body.payload.get("source_language", "COBOL")
    target_lang = body.payload.get("target_language", "Python")

    if not source_code:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="payload.source_code is required for legacy conversion.",
        )

    async def _ai():
        return await ai_client.convert_legacy_code(
            source_code=source_code,
            source_lang=source_lang,
            target_lang=target_lang,
        )

    return await _execute_trigger(
        db=db,
        current_user=current_user,
        body=body,
        engine="legacy_converter",
        trigger_source="LCC-002",
        ai_callable=_ai,
        result_key="converted_code",
    )


# ===========================================================================
# 10. POST /ai/business-extractor/trigger â€” BEX-001
# ===========================================================================


@router.post(
    "/business-extractor/trigger",
    response_model=AIJobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="BEX-001: Trigger business logic extraction",
    description=(
        "Trigger the BusinessExtractor engine to reverse-engineer business rules, "
        "process flows, and entities from a source-code snippet. "
        "Provide code_snippet in the payload."
    ),
)
async def trigger_business_extractor(
    body: TriggerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AIJobResponse:
    code_snippet = body.payload.get("code_snippet", "")

    if not code_snippet:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="payload.code_snippet is required for business logic extraction.",
        )

    async def _ai():
        return await ai_client.extract_business_logic(code_snippet=code_snippet)

    return await _execute_trigger(
        db=db,
        current_user=current_user,
        body=body,
        engine="business_extractor",
        trigger_source="BEX-001",
        ai_callable=_ai,
        result_key="extraction",
    )


# ===========================================================================
# 11. GET /ai/jobs/{job_id}/result â€” Get just the result payload
# ===========================================================================


@router.get(
    "/jobs/{job_id}/result",
    response_model=MessageResponse,
    summary="Get AI job result",
    description=(
        "Return only the result payload of a completed AI job. "
        "Raises 404 if the job does not exist, 409 if the job has not yet completed."
    ),
)
async def get_job_result(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    job = await _get_job_or_404(job_id, db)
    if job.org_id != current_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied.",
        )
    if job.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Job is in status '{job.status}'; result is only available for completed jobs.",
        )
    return MessageResponse(
        message=f"Result for AI job '{job_id}'.",
        data=job.result,
    )


# ===========================================================================
# 12. GET /ai/stats/{project_id} â€” Job statistics for a project
# ===========================================================================


@router.get(
    "/stats/{project_id}",
    response_model=MessageResponse,
    summary="AI job statistics",
    description=(
        "Return aggregate job statistics for a project: total count, completed, "
        "failed, and a breakdown by engine."
    ),
)
async def get_project_stats(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    project = await _get_project_or_404(project_id, db)
    if project.org_id != current_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied.",
        )

    # Total jobs
    total_result = await db.execute(
        select(func.count(AIJob.id)).where(AIJob.project_id == project_id)
    )
    total: int = total_result.scalar_one() or 0

    # Completed jobs
    completed_result = await db.execute(
        select(func.count(AIJob.id)).where(
            AIJob.project_id == project_id,
            AIJob.status == "completed",
        )
    )
    completed: int = completed_result.scalar_one() or 0

    # Failed jobs
    failed_result = await db.execute(
        select(func.count(AIJob.id)).where(
            AIJob.project_id == project_id,
            AIJob.status == "failed",
        )
    )
    failed: int = failed_result.scalar_one() or 0

    # Breakdown by engine â€” fetch (engine, count) pairs
    by_engine_result = await db.execute(
        select(AIJob.engine, func.count(AIJob.id))
        .where(AIJob.project_id == project_id)
        .group_by(AIJob.engine)
    )
    by_engine: Dict[str, int] = {
        row[0]: row[1] for row in by_engine_result.all()
    }

    stats = {
        "project_id": project_id,
        "total": total,
        "completed": completed,
        "failed": failed,
        "by_engine": by_engine,
    }

    return MessageResponse(
        message=f"AI job statistics for project '{project_id}'.",
        data=stats,
    )

