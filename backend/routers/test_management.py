"""
Xccelera AI-SDLC Platform â€” Test Management Router.

Implements TST-001 through TST-006:
  TST-001  AI test case generation
  TST-002  Test run execution (simulated)
  TST-003  Coverage analysis
  TST-004  AI regression test selection
  TST-006  Performance test simulation

Prefix : /tests
Tags   : Test Management
"""

from __future__ import annotations

import math
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import ai_client
from auth import get_optional_user
from database import get_db
from models import MEEEvent, Requirement, TestCase, TestRun
from schemas import (
    GenerateTestsRequest,
    MessageResponse,
    TestCaseCreate,
    TestCaseResponse,
    TestRunResponse,
)

router = APIRouter(prefix="/tests", tags=["Test Management"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _tc_to_response(tc: TestCase) -> TestCaseResponse:
    """Coerce a TestCase ORM row to TestCaseResponse."""
    return TestCaseResponse.model_validate(tc)


def _tr_to_response(tr: TestRun) -> TestRunResponse:
    """Coerce a TestRun ORM row to TestRunResponse."""
    return TestRunResponse.model_validate(tr)


async def _get_test_case_or_404(case_id: str, db: AsyncSession) -> TestCase:
    result = await db.execute(select(TestCase).where(TestCase.id == case_id))
    tc = result.scalar_one_or_none()
    if tc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test case not found")
    return tc


async def _get_test_run_or_404(run_id: str, db: AsyncSession) -> TestRun:
    result = await db.execute(select(TestRun).where(TestRun.id == run_id))
    tr = result.scalar_one_or_none()
    if tr is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test run not found")
    return tr


# ---------------------------------------------------------------------------
# TST â€” CRUD endpoints for test cases
# ---------------------------------------------------------------------------


@router.get("/cases", response_model=List[TestCaseResponse])
async def list_test_cases(
    project_id: str,
    requirement_id: Optional[str] = None,
    type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> List[TestCaseResponse]:
    """List test cases for a project, optionally filtered by requirement and type."""
    query = select(TestCase).where(TestCase.project_id == project_id)
    if requirement_id:
        query = query.where(TestCase.requirement_id == requirement_id)
    if type:
        query = query.where(TestCase.type == type)
    query = query.order_by(TestCase.created_at.desc())

    result = await db.execute(query)
    cases = result.scalars().all()
    return [_tc_to_response(tc) for tc in cases]


@router.post("/cases", response_model=TestCaseResponse, status_code=status.HTTP_201_CREATED)
async def create_test_case(
    project_id: str,
    body: TestCaseCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> TestCaseResponse:
    """Create a new test case for the given project."""
    tc = TestCase(
        id=str(uuid.uuid4()),
        project_id=project_id,
        requirement_id=body.requirement_id,
        title=body.title,
        description=body.description,
        type=body.type,
        steps=body.steps,
        expected_result=body.expected_result,
        ai_generated=False,
    )
    db.add(tc)
    await db.flush()
    await db.refresh(tc)
    return _tc_to_response(tc)


@router.get("/cases/{case_id}", response_model=TestCaseResponse)
async def get_test_case(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> TestCaseResponse:
    """Fetch a single test case by ID."""
    tc = await _get_test_case_or_404(case_id, db)
    return _tc_to_response(tc)


@router.put("/cases/{case_id}", response_model=TestCaseResponse)
async def update_test_case(
    case_id: str,
    body: TestCaseCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> TestCaseResponse:
    """Update an existing test case."""
    tc = await _get_test_case_or_404(case_id, db)
    tc.title = body.title
    tc.description = body.description
    tc.type = body.type
    tc.steps = body.steps
    tc.expected_result = body.expected_result
    if body.requirement_id is not None:
        tc.requirement_id = body.requirement_id
    await db.flush()
    await db.refresh(tc)
    return _tc_to_response(tc)


@router.delete("/cases/{case_id}", response_model=MessageResponse)
async def delete_test_case(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> MessageResponse:
    """Delete a test case by ID."""
    tc = await _get_test_case_or_404(case_id, db)
    await db.delete(tc)
    return MessageResponse(message="Test case deleted successfully", data={"id": case_id})


# ---------------------------------------------------------------------------
# TST-001 â€” AI test case generation
# ---------------------------------------------------------------------------


@router.post("/generate", response_model=List[TestCaseResponse])
async def generate_test_cases(
    body: GenerateTestsRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> List[TestCaseResponse]:
    """
    TST-001: Generate test cases from requirements using the AI engine.

    If requirement_id is provided, generates tests for that single requirement.
    Otherwise, generates tests for all requirements belonging to the project.
    """
    # Fetch target requirements
    if body.requirement_id:
        result = await db.execute(
            select(Requirement).where(
                Requirement.id == body.requirement_id,
                Requirement.project_id == body.project_id,
            )
        )
        requirements = result.scalars().all()
        if not requirements:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Requirement not found for this project",
            )
    else:
        result = await db.execute(
            select(Requirement).where(Requirement.project_id == body.project_id)
        )
        requirements = result.scalars().all()

    if not requirements:
        return []

    created: List[TestCase] = []

    for req in requirements:
        raw_cases = await ai_client.generate_test_cases(
            requirement_title=req.title,
            requirement_description=req.description,
            acceptance_criteria=req.acceptance_criteria,
        )
        for raw in raw_cases:
            tc = TestCase(
                id=str(uuid.uuid4()),
                project_id=body.project_id,
                requirement_id=req.id,
                title=raw.get("title", "Untitled test case"),
                description=raw.get("description", ""),
                type=raw.get("type", "unit"),
                steps=raw.get("steps", []),
                expected_result=raw.get("expected_result", ""),
                ai_generated=True,
            )
            db.add(tc)
            created.append(tc)

    await db.flush()
    for tc in created:
        await db.refresh(tc)

    # Emit MEE event
    event = MEEEvent(
        id=str(uuid.uuid4()),
        project_id=body.project_id,
        engine="TST-001",
        event_type="test_cases_generated",
        description=(
            f"AI generated {len(created)} test case(s) for project {body.project_id}"
        ),
        event_metadata={
            "project_id": body.project_id,
            "requirement_id": body.requirement_id,
            "cases_generated": len(created),
        },
        severity="info",
    )
    db.add(event)

    return [_tc_to_response(tc) for tc in created]


# ---------------------------------------------------------------------------
# TST-002 â€” Execute test run
# ---------------------------------------------------------------------------


class _ExecuteRequest:
    """Inline request model for test execution (avoids polluting schemas.py)."""


from pydantic import BaseModel  # noqa: E402 â€” placed after router setup intentionally


class ExecuteTestsRequest(BaseModel):
    project_id: str
    case_ids: Optional[List[str]] = None


@router.post("/execute", response_model=TestRunResponse, status_code=status.HTTP_201_CREATED)
async def execute_tests(
    body: ExecuteTestsRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> TestRunResponse:
    """
    TST-002: Execute a simulated test run.

    Fetches the target test cases (all for the project, or the specified subset),
    applies a deterministic 85 % pass rate, persists a TestRun record, and returns it.
    """
    # Resolve the set of test cases to run
    if body.case_ids:
        query = select(TestCase).where(
            TestCase.project_id == body.project_id,
            TestCase.id.in_(body.case_ids),
        )
    else:
        query = select(TestCase).where(TestCase.project_id == body.project_id)

    result = await db.execute(query)
    cases = result.scalars().all()

    total = len(cases)
    now = datetime.utcnow()

    if total == 0:
        # Nothing to run â€” return an empty completed run
        run = TestRun(
            id=str(uuid.uuid4()),
            project_id=body.project_id,
            status="completed",
            total_cases=0,
            passed=0,
            failed=0,
            skipped=0,
            coverage_pct=0.0,
            started_at=now,
            completed_at=now,
        )
        db.add(run)
        await db.flush()
        await db.refresh(run)
        return _tr_to_response(run)

    # Deterministic demo: 85 % pass rate, 10 % fail, 5 % skip
    passed = math.ceil(total * 0.85)
    skipped = math.ceil(total * 0.05)
    failed = total - passed - skipped
    if failed < 0:
        failed = 0
        skipped = total - passed

    # Coverage approximation: based on pass rate
    coverage_pct = round((passed / total) * 100, 1)

    run = TestRun(
        id=str(uuid.uuid4()),
        project_id=body.project_id,
        status="completed",
        total_cases=total,
        passed=passed,
        failed=failed,
        skipped=skipped,
        coverage_pct=coverage_pct,
        started_at=now,
        completed_at=now,
    )
    db.add(run)
    await db.flush()
    await db.refresh(run)
    return _tr_to_response(run)


# ---------------------------------------------------------------------------
# Test Run CRUD
# ---------------------------------------------------------------------------


@router.get("/runs", response_model=List[TestRunResponse])
async def list_test_runs(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> List[TestRunResponse]:
    """List all test runs for a project, newest first."""
    result = await db.execute(
        select(TestRun)
        .where(TestRun.project_id == project_id)
        .order_by(TestRun.created_at.desc())
    )
    runs = result.scalars().all()
    return [_tr_to_response(tr) for tr in runs]


@router.get("/runs/{run_id}", response_model=TestRunResponse)
async def get_test_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> TestRunResponse:
    """Fetch a single test run by ID."""
    tr = await _get_test_run_or_404(run_id, db)
    return _tr_to_response(tr)


# ---------------------------------------------------------------------------
# TST-003 â€” Coverage analysis
# ---------------------------------------------------------------------------


@router.get("/coverage/{project_id}")
async def get_coverage(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """
    TST-003: Return coverage analysis for a project.

    Derives coverage_pct from the most recent completed test run, fills in
    plausible uncovered areas, and returns a mock sprint trend.
    """
    # Latest completed run
    result = await db.execute(
        select(TestRun)
        .where(
            TestRun.project_id == project_id,
            TestRun.status == "completed",
        )
        .order_by(TestRun.created_at.desc())
        .limit(1)
    )
    latest_run = result.scalar_one_or_none()

    if latest_run and latest_run.coverage_pct is not None:
        coverage_pct = latest_run.coverage_pct
    else:
        coverage_pct = 72.5  # reasonable demo baseline

    # Determine uncovered areas based on coverage gap
    all_uncovered = [
        "Error handling paths",
        "Edge cases in input validation",
        "Concurrency scenarios",
        "Database failure recovery",
        "Third-party API timeout handling",
        "Role-based access control edge cases",
    ]
    # More areas shown when coverage is lower
    uncovered_count = max(1, round((100 - coverage_pct) / 15))
    uncovered_areas = all_uncovered[:uncovered_count]

    # Fetch up to 5 completed runs to build a trend
    runs_result = await db.execute(
        select(TestRun)
        .where(
            TestRun.project_id == project_id,
            TestRun.status == "completed",
        )
        .order_by(TestRun.created_at.asc())
        .limit(5)
    )
    runs = runs_result.scalars().all()

    if runs:
        trend = [
            {
                "sprint": f"Sprint {i + 1}",
                "coverage": round(run.coverage_pct or 0.0, 1),
            }
            for i, run in enumerate(runs)
        ]
    else:
        # Mock trend data when no runs exist yet
        trend = [
            {"sprint": "Sprint 1", "coverage": 55.0},
            {"sprint": "Sprint 2", "coverage": 63.5},
            {"sprint": "Sprint 3", "coverage": 70.0},
            {"sprint": "Sprint 4", "coverage": 72.5},
        ]

    return {
        "coverage_pct": coverage_pct,
        "uncovered_areas": uncovered_areas,
        "trend": trend,
    }


# ---------------------------------------------------------------------------
# TST-004 â€” AI regression test selection
# ---------------------------------------------------------------------------


class RegressionSelectRequest(BaseModel):
    project_id: str
    changed_files: List[str]


@router.post("/regression/select")
async def select_regression_tests(
    body: RegressionSelectRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """
    TST-004: Intelligently select regression tests relevant to changed files.

    Selects approximately 30 % of the project's test cases, prioritising those
    whose title keywords overlap with the changed file names.
    """
    result = await db.execute(
        select(TestCase)
        .where(TestCase.project_id == body.project_id)
        .order_by(TestCase.created_at.desc())
    )
    all_cases = result.scalars().all()

    if not all_cases:
        return {
            "selected_tests": [],
            "rationale": "No test cases found for this project.",
        }

    # Build a keyword set from changed file names (stem words, lowercased)
    def _file_keywords(path: str) -> set:
        """Extract meaningful words from a file path."""
        import re
        parts = re.split(r"[/\\._\-]", path.lower())
        stop = {"py", "ts", "tsx", "js", "jsx", "test", "spec", "index", "src", "lib"}
        return {p for p in parts if p and p not in stop and len(p) > 2}

    changed_keywords: set = set()
    for f in body.changed_files:
        changed_keywords.update(_file_keywords(f))

    # Score each test case by keyword overlap with changed files
    def _score(tc: TestCase) -> int:
        words = set(tc.title.lower().split())
        return len(words & changed_keywords)

    scored = sorted(all_cases, key=_score, reverse=True)

    # Select ~30 % but at least 1 and at most all
    target_count = max(1, math.ceil(len(scored) * 0.30))
    selected = scored[:target_count]

    changed_summary = ", ".join(body.changed_files[:5])
    if len(body.changed_files) > 5:
        changed_summary += f" â€¦ (+{len(body.changed_files) - 5} more)"

    rationale = (
        f"Selected {len(selected)} of {len(all_cases)} test cases "
        f"({round(len(selected) / len(all_cases) * 100)}%) "
        f"based on relevance to changed files: {changed_summary}. "
        f"Tests are ranked by keyword overlap with modified paths."
    )

    return {
        "selected_tests": [_tc_to_response(tc) for tc in selected],
        "rationale": rationale,
    }


# ---------------------------------------------------------------------------
# TST-006 â€” Performance test
# ---------------------------------------------------------------------------


class PerformanceTestRequest(BaseModel):
    project_id: str
    target_url: str = "http://localhost:8000"
    concurrent_users: int = 10


@router.post("/performance")
async def run_performance_test(
    body: PerformanceTestRequest,
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """
    TST-006: Simulate a performance / load test and return realistic mock metrics.

    The metrics scale plausibly with concurrent_users:
      - Higher concurrency â†’ lower RPS and higher avg latency.
      - Error rate grows slightly under higher load.
    """
    users = max(1, body.concurrent_users)

    # Realistic scaling: baseline at 10 concurrent users
    baseline_rps = 450.0
    baseline_latency_ms = 42.0
    baseline_error_rate = 0.005  # 0.5 %

    # Scale factor: RPS degrades, latency increases with load
    scale = users / 10.0
    requests_per_second = round(baseline_rps / (1 + math.log(scale + 1)), 2)
    avg_response_ms = round(baseline_latency_ms * (1 + math.log(scale + 1) * 0.8), 1)
    error_rate = round(min(0.15, baseline_error_rate * scale), 4)

    return {
        "results": {
            "requests_per_second": requests_per_second,
            "avg_response_ms": avg_response_ms,
            "error_rate": error_rate,
            "concurrent_users": users,
            "target_url": body.target_url,
            "duration_seconds": 30,
            "total_requests": round(requests_per_second * 30),
        },
        "status": "completed",
    }

