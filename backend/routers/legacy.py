"""
Xccelera AI-SDLC Platform — Legacy Code Conversion router.

Covers LCC-001 through LCC-007 plus BEX-001-style business logic analysis:
  LCC-001  Ingest legacy code (POST /ingest)
  LCC-002  Start conversion    (POST /convert)
  LCC-003  Detailed report     (GET  /jobs/{job_id}/report)
  LCC-004  Validate output     (POST /validate)
  LCC-006  Generate tests      (POST /jobs/{job_id}/tests/generate)
  BEX-001  Analyze business logic (POST /analyze)
  Utility  Supported language pairs (GET /supported-languages)
  CRUD     List jobs / get job  (GET /jobs, GET /jobs/{job_id})
"""

from __future__ import annotations

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
from models import LegacyJob
from schemas import LegacyJobResponse

router = APIRouter(prefix="/legacy", tags=["Legacy Code Conversion"])

# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------


class IngestRequest(BaseModel):
    project_id: str
    source_language: str
    target_language: str
    source_code: str
    filename: Optional[str] = None


class ConvertRequest(BaseModel):
    job_id: Optional[str] = None
    project_id: Optional[str] = None
    source_language: Optional[str] = None
    target_language: Optional[str] = None
    source_code: Optional[str] = None


class ValidateRequest(BaseModel):
    job_id: str


class AnalyzeRequest(BaseModel):
    source_code: str
    source_language: str


# ---------------------------------------------------------------------------
# Supported language pairs
# ---------------------------------------------------------------------------

_SUPPORTED_PAIRS: List[Dict[str, Any]] = [
    {"source": "COBOL",   "targets": ["Java", "Python", "C#"]},
    {"source": "FORTRAN", "targets": ["Python", "C#"]},
    {"source": "VB6",     "targets": ["C#", "Python"]},
    {"source": "RPG",     "targets": ["Java"]},
]

# ---------------------------------------------------------------------------
# Helper — build a report dict from a completed LegacyJob
# ---------------------------------------------------------------------------


def _build_report(
    job: LegacyJob,
    converted_code: str,
) -> Dict[str, Any]:
    """Construct the conversion report stored on the job."""
    return {
        "job_id": job.id,
        "source_language": job.source_language,
        "target_language": job.target_language,
        "files_converted": job.files_total,
        "logic_mappings": [],
        "business_rules": [],
        "ambiguities": [],
        "converted_code": converted_code,
        "summary": (
            f"Successfully converted {job.files_total} file(s) from "
            f"{job.source_language} to {job.target_language}."
        ),
    }


# ===========================================================================
# GET /jobs
# ===========================================================================


@router.get("/jobs", response_model=List[LegacyJobResponse])
async def list_jobs(
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> List[LegacyJobResponse]:
    """List legacy conversion jobs, optionally filtered by project_id."""
    stmt = select(LegacyJob)
    if project_id:
        stmt = stmt.where(LegacyJob.project_id == project_id)
    result = await db.execute(stmt)
    jobs = result.scalars().all()
    return [LegacyJobResponse.model_validate(j) for j in jobs]


# ===========================================================================
# GET /jobs/{job_id}
# ===========================================================================


@router.get("/jobs/{job_id}", response_model=LegacyJobResponse)
async def get_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> LegacyJobResponse:
    """Get details of a single legacy conversion job."""
    result = await db.execute(select(LegacyJob).where(LegacyJob.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Legacy job not found",
        )
    return LegacyJobResponse.model_validate(job)


# ===========================================================================
# POST /ingest  (LCC-001)
# ===========================================================================


@router.post(
    "/ingest",
    response_model=LegacyJobResponse,
    status_code=status.HTTP_201_CREATED,
)
async def ingest_code(
    body: IngestRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> LegacyJobResponse:
    """LCC-001 — Ingest legacy source code and create a queued conversion job."""
    job = LegacyJob(
        id=str(uuid.uuid4()),
        project_id=body.project_id,
        source_language=body.source_language,
        target_language=body.target_language,
        status="queued",
        progress_pct=0,
        files_total=1,
        files_converted=0,
        report={
            "source_code": body.source_code,
            "filename": body.filename or "unknown",
        },
    )
    db.add(job)
    await db.flush()
    return LegacyJobResponse.model_validate(job)


# ===========================================================================
# POST /convert  (LCC-002)
# ===========================================================================


@router.post("/convert", response_model=LegacyJobResponse)
async def convert_code(
    body: ConvertRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> LegacyJobResponse:
    """
    LCC-002 — Convert legacy code to a modern target language.

    Accepts either:
    - ``job_id`` to resume a previously ingested job, or
    - Inline ``project_id``, ``source_language``, ``target_language``, ``source_code``
      to create-and-convert in one step.
    """
    now = datetime.utcnow()

    if body.job_id:
        # Resume an existing job
        result = await db.execute(
            select(LegacyJob).where(LegacyJob.id == body.job_id)
        )
        job = result.scalar_one_or_none()
        if job is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Legacy job not found",
            )
        # Source code was stored in the report metadata at ingest time
        source_code = (job.report or {}).get("source_code", "")
        source_lang = job.source_language
        target_lang = job.target_language
    else:
        # Inline conversion — all fields required
        if not (body.project_id and body.source_language and body.target_language and body.source_code):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Provide either job_id or all of: "
                    "project_id, source_language, target_language, source_code"
                ),
            )
        source_code = body.source_code
        source_lang = body.source_language
        target_lang = body.target_language

        job = LegacyJob(
            id=str(uuid.uuid4()),
            project_id=body.project_id,
            source_language=source_lang,
            target_language=target_lang,
            status="queued",
            progress_pct=0,
            files_total=1,
            files_converted=0,
            report={"source_code": source_code},
        )
        db.add(job)
        await db.flush()

    # Mark running
    job.status = "running"
    job.progress_pct = 0
    job.updated_at = now
    await db.flush()

    # AI conversion
    converted_code = await ai_client.convert_legacy_code(
        source_code, source_lang, target_lang
    )

    # Build and persist report
    report = _build_report(job, converted_code)
    job.status = "completed"
    job.progress_pct = 100
    job.files_converted = job.files_total
    job.report = report
    job.updated_at = datetime.utcnow()
    await db.flush()

    return LegacyJobResponse.model_validate(job)


# ===========================================================================
# GET /jobs/{job_id}/report  (LCC-003)
# ===========================================================================


@router.get("/jobs/{job_id}/report")
async def get_job_report(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """LCC-003 — Return the detailed conversion report for a completed job."""
    result = await db.execute(select(LegacyJob).where(LegacyJob.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Legacy job not found",
        )
    if not job.report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not yet available — run conversion first",
        )
    return job.report


# ===========================================================================
# POST /validate  (LCC-004)
# ===========================================================================


@router.post("/validate")
async def validate_code(
    body: ValidateRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """
    LCC-004 — Validate the converted code for a completed job.

    Runs a simulated static analysis check and returns a quality score.
    """
    result = await db.execute(select(LegacyJob).where(LegacyJob.id == body.job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Legacy job not found",
        )
    if job.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job must be in 'completed' status before validation",
        )

    # Simulated validation — demo quality metrics
    return {
        "job_id": body.job_id,
        "valid": True,
        "issues": [],
        "quality_score": 0.87,
        "style_compliance": 0.92,
    }


# ===========================================================================
# POST /jobs/{job_id}/tests/generate  (LCC-006)
# ===========================================================================


@router.post("/jobs/{job_id}/tests/generate")
async def generate_tests(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """LCC-006 — Generate test cases for the converted code of a completed job."""
    result = await db.execute(select(LegacyJob).where(LegacyJob.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Legacy job not found",
        )
    if job.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job must be in 'completed' status before generating tests",
        )

    converted_code = (job.report or {}).get("converted_code", "")
    summary = (job.report or {}).get("summary", "Legacy code conversion")

    test_cases = await ai_client.generate_test_cases(
        requirement_title=f"Converted {job.source_language} → {job.target_language}",
        requirement_description=summary,
        acceptance_criteria=[
            f"Converted {job.target_language} code executes without runtime errors",
            "All original business logic is preserved after conversion",
            "Output matches expected values from legacy system",
        ],
    )

    return {
        "job_id": job_id,
        "source_language": job.source_language,
        "target_language": job.target_language,
        "test_cases": test_cases,
    }


# ===========================================================================
# POST /analyze  (BEX-001 style)
# ===========================================================================


@router.post("/analyze")
async def analyze_business_logic(
    body: AnalyzeRequest,
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """
    BEX-001 — Analyze source code and extract embedded business logic.

    Does not persist a job record; returns extraction results immediately.
    """
    extraction = await ai_client.extract_business_logic(body.source_code)
    return {
        "source_language": body.source_language,
        **extraction,
    }


# ===========================================================================
# GET /supported-languages
# ===========================================================================


@router.get("/supported-languages")
async def list_supported_languages(
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """Return the set of supported legacy source → target language pairs."""
    return {"pairs": _SUPPORTED_PAIRS}
