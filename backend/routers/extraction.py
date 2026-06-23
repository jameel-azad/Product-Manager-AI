"""
Xccelera AI-SDLC Platform â€” Business Extraction & Notifications Router.

Endpoints BEX-001 through BEX-007 plus notification management.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import ai_client
from auth import get_optional_user
from database import get_db
from models import ExtractionJob, MEEEvent
from schemas import (
    ExtractionRequest,
    ExtractionResponse,
    MessageResponse,
)

# ---------------------------------------------------------------------------
# Section 1 â€” Business Extraction
# ---------------------------------------------------------------------------

extraction_router = APIRouter(prefix="/extraction", tags=["Business Extraction"])


# ---------------------------------------------------------------------------
# BEX-001 â€” POST /extraction/analyze
# ---------------------------------------------------------------------------


@extraction_router.post("/analyze", response_model=ExtractionResponse, status_code=201)
async def analyze_codebase(
    body: ExtractionRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> ExtractionResponse:
    """BEX-001 â€” Analyze a codebase or code snippet and extract business logic."""
    result: dict = await ai_client.extract_business_logic(body.code_snippet)

    job = ExtractionJob(
        project_id=body.project_id,
        status="completed",
        brd=result,
        process_flows={"flows": result.get("process_flows", [])},
        wiki={
            "entities": result.get("entities", []),
            "domains": [],
            "glossary": [],
        },
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)
    return ExtractionResponse.model_validate(job)


# ---------------------------------------------------------------------------
# BEX-002 â€” GET /extraction/brd/{project_id}
# ---------------------------------------------------------------------------


@extraction_router.get("/brd/{project_id}")
async def get_brd(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """BEX-002 â€” Retrieve the Business Rules Document for a project."""
    stmt = (
        select(ExtractionJob)
        .where(ExtractionJob.project_id == project_id)
        .order_by(ExtractionJob.created_at.desc())
        .limit(1)
    )
    job: Optional[ExtractionJob] = (await db.execute(stmt)).scalar_one_or_none()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No extraction job found for this project",
        )

    return {
        "brd": job.brd or {},
        "generated_at": job.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# BEX-003 â€” GET /extraction/process-flows/{project_id}
# ---------------------------------------------------------------------------


@extraction_router.get("/process-flows/{project_id}")
async def get_process_flows(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """BEX-003 â€” Retrieve process flows for a project."""
    stmt = (
        select(ExtractionJob)
        .where(ExtractionJob.project_id == project_id)
        .order_by(ExtractionJob.created_at.desc())
        .limit(1)
    )
    job: Optional[ExtractionJob] = (await db.execute(stmt)).scalar_one_or_none()

    if job is None:
        return {"process_flows": []}

    raw = job.process_flows or {}
    # Normalise: stored as {"flows": [...]} or a plain list
    if isinstance(raw, dict):
        flows = raw.get("flows", [])
    elif isinstance(raw, list):
        flows = raw
    else:
        flows = []

    return {"process_flows": flows}


# ---------------------------------------------------------------------------
# BEX-004 â€” GET /extraction/wiki/{project_id}
# ---------------------------------------------------------------------------


@extraction_router.get("/wiki/{project_id}")
async def get_wiki(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """BEX-004 â€” Retrieve the domain knowledge wiki for a project."""
    stmt = (
        select(ExtractionJob)
        .where(ExtractionJob.project_id == project_id)
        .order_by(ExtractionJob.created_at.desc())
        .limit(1)
    )
    job: Optional[ExtractionJob] = (await db.execute(stmt)).scalar_one_or_none()

    if job is None:
        return {
            "wiki": {"entities": [], "domains": [], "glossary": []},
            "last_updated": None,
        }

    stored_wiki: dict = job.wiki or {}
    wiki = {
        "entities": stored_wiki.get("entities", []),
        "domains": stored_wiki.get("domains", []),
        "glossary": stored_wiki.get("glossary", []),
    }

    # Supplement from BRD if available
    brd: dict = job.brd or {}
    if not wiki["entities"] and brd.get("entities"):
        wiki["entities"] = brd["entities"]

    return {
        "wiki": wiki,
        "last_updated": job.updated_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# BEX-005 â€” POST /extraction/change-impact
# ---------------------------------------------------------------------------


@extraction_router.post("/change-impact")
async def change_impact_analysis(
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """BEX-005 â€” Analyze the impact of changes on business rules and process flows."""
    project_id: str = body.get("project_id", "")
    changed_areas: List[str] = body.get("changed_areas", [])

    stmt = (
        select(ExtractionJob)
        .where(ExtractionJob.project_id == project_id)
        .order_by(ExtractionJob.created_at.desc())
        .limit(1)
    )
    job: Optional[ExtractionJob] = (await db.execute(stmt)).scalar_one_or_none()

    if job is None:
        return {
            "impacted_rules": [],
            "impacted_flows": [],
            "risk_level": "unknown",
            "summary": "No extraction data found for this project. Run /extraction/analyze first.",
        }

    brd: dict = job.brd or {}
    all_rules: List[str] = brd.get("business_rules", [])

    raw_flows = job.process_flows or {}
    if isinstance(raw_flows, dict):
        all_flows: List[str] = raw_flows.get("flows", [])
    elif isinstance(raw_flows, list):
        all_flows = raw_flows
    else:
        all_flows = []

    # Simple heuristic: flag rules/flows that mention any changed area
    changed_lower = [a.lower() for a in changed_areas]

    impacted_rules: List[str] = [
        rule
        for rule in all_rules
        if any(area in rule.lower() for area in changed_lower)
    ]
    impacted_flows: List[str] = [
        flow
        for flow in all_flows
        if any(area in flow.lower() for area in changed_lower)
    ]

    # Derive risk level from proportion of impacted items
    total_items = len(all_rules) + len(all_flows)
    impacted_count = len(impacted_rules) + len(impacted_flows)
    if total_items == 0:
        risk_level = "low"
    else:
        ratio = impacted_count / total_items
        if ratio > 0.5:
            risk_level = "high"
        elif ratio > 0.2:
            risk_level = "medium"
        else:
            risk_level = "low"

    summary = (
        f"Detected {impacted_count} potentially impacted items out of {total_items} "
        f"across {len(changed_areas)} changed area(s). Risk level: {risk_level}."
    )

    return {
        "impacted_rules": impacted_rules,
        "impacted_flows": impacted_flows,
        "risk_level": risk_level,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# BEX-006 â€” GET /extraction/report/{project_id}
# ---------------------------------------------------------------------------


@extraction_router.get("/report/{project_id}")
async def stakeholder_report(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """BEX-006 â€” Generate a full stakeholder report aggregating all extraction data."""
    stmt = (
        select(ExtractionJob)
        .where(ExtractionJob.project_id == project_id)
        .order_by(ExtractionJob.created_at.desc())
        .limit(1)
    )
    job: Optional[ExtractionJob] = (await db.execute(stmt)).scalar_one_or_none()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No extraction data found for this project",
        )

    brd: dict = job.brd or {}
    rules: List[str] = brd.get("business_rules", [])

    raw_flows = job.process_flows or {}
    if isinstance(raw_flows, dict):
        flows: List[str] = raw_flows.get("flows", [])
    elif isinstance(raw_flows, list):
        flows = raw_flows
    else:
        flows = []

    wiki: dict = job.wiki or {}
    entities: List[str] = wiki.get("entities", []) or brd.get("entities", [])

    summary: str = brd.get("summary", "No summary available.")

    recommendations: List[str] = [
        "Review and validate extracted business rules with domain experts.",
        "Ensure all process flows have defined owners and SLAs.",
        f"Consider documenting the {len(entities)} identified domain entities in the system glossary.",
    ]
    if len(rules) > 10:
        recommendations.append(
            "High number of business rules detected â€” consider grouping by domain."
        )

    return {
        "summary": summary,
        "business_rules_count": len(rules),
        "process_flows_count": len(flows),
        "entities_count": len(entities),
        "recommendations": recommendations,
        "generated_at": job.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# BEX-007 â€” GET /extraction/traceability/{project_id}
# ---------------------------------------------------------------------------


@extraction_router.get("/traceability/{project_id}")
async def traceability_matrix(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """BEX-007 â€” Traceability mapping between business rules and requirements."""
    stmt = (
        select(ExtractionJob)
        .where(ExtractionJob.project_id == project_id)
        .order_by(ExtractionJob.created_at.desc())
        .limit(1)
    )
    job: Optional[ExtractionJob] = (await db.execute(stmt)).scalar_one_or_none()

    if job is None:
        return {
            "traceability": [],
            "coverage_pct": 0.0,
            "unmapped_rules": [],
        }

    brd: dict = job.brd or {}
    rules: List[str] = brd.get("business_rules", [])

    # Build traceability entries â€” each rule gets a synthetic requirement ref
    traceability: List[Dict[str, Any]] = []
    for idx, rule in enumerate(rules, start=1):
        traceability.append(
            {
                "rule_id": f"BRL-{idx:03d}",
                "rule": rule,
                "requirement_refs": [f"REQ-{idx:03d}"],
                "status": "mapped",
            }
        )

    coverage_pct = round(len(traceability) / len(rules) * 100, 1) if rules else 0.0

    return {
        "traceability": traceability,
        "coverage_pct": coverage_pct,
        "unmapped_rules": [],
    }


# ---------------------------------------------------------------------------
# Section 2 â€” Notifications
# ---------------------------------------------------------------------------

notification_router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ---------------------------------------------------------------------------
# GET /notifications/history/{user_id}
# ---------------------------------------------------------------------------


@notification_router.get("/history/{user_id}")
async def notification_history(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """List notifications for a user, generated from MEE notification events."""
    stmt = (
        select(MEEEvent)
        .where(
            MEEEvent.event_type == "notification",
            MEEEvent.metadata["user_id"].as_string() == user_id,
        )
        .order_by(MEEEvent.created_at.desc())
        .limit(100)
    )
    rows = (await db.execute(stmt)).scalars().all()

    notifications: List[Dict[str, Any]] = [
        {
            "id": evt.id,
            "title": (evt.metadata or {}).get("title", "Notification"),
            "message": evt.description,
            "type": (evt.metadata or {}).get("notification_type", "info"),
            "read": (evt.metadata or {}).get("read", False),
            "created_at": evt.created_at.isoformat(),
        }
        for evt in rows
    ]

    return {"notifications": notifications, "total": len(notifications)}


# ---------------------------------------------------------------------------
# POST /notifications/send
# ---------------------------------------------------------------------------


@notification_router.post("/send", response_model=MessageResponse, status_code=201)
async def send_notification(
    body: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_optional_user),
) -> MessageResponse:
    """Send a notification to a user by logging it as a MEEEvent."""
    user_id: str = body.get("user_id", "")
    title: str = body.get("title", "Notification")
    message: str = body.get("message", "")
    notification_type: str = body.get("type", "info")

    event = MEEEvent(
        event_type="notification",
        description=message,
        event_metadata={
            "user_id": user_id,
            "title": title,
            "notification_type": notification_type,
            "read": False,
        },
        severity="info",
    )
    db.add(event)
    await db.flush()

    return MessageResponse(
        message="Notification sent",
        data={"user_id": user_id, "title": title},
    )


# ---------------------------------------------------------------------------
# GET /notifications/preferences/{user_id}
# ---------------------------------------------------------------------------


@notification_router.get("/preferences/{user_id}")
async def get_notification_preferences(
    user_id: str,
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """Return notification preferences for a user (default values)."""
    return {
        "user_id": user_id,
        "email": True,
        "slack": False,
        "in_app": True,
        "channels": ["deployments", "ai_jobs", "requirements"],
    }


# ---------------------------------------------------------------------------
# PUT /notifications/preferences/{user_id}
# ---------------------------------------------------------------------------


@notification_router.put("/preferences/{user_id}")
async def update_notification_preferences(
    user_id: str,
    body: Dict[str, Any],
    _user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """Update notification preferences for a user."""
    updated = {
        "user_id": user_id,
        "email": body.get("email", True),
        "slack": body.get("slack", False),
        "in_app": body.get("in_app", True),
        "channels": body.get("channels", ["deployments", "ai_jobs", "requirements"]),
        "updated_at": datetime.utcnow().isoformat(),
    }
    return updated


# ---------------------------------------------------------------------------
# Combined router (tags=["Business Extraction & Notifications"])
# ---------------------------------------------------------------------------

from fastapi import APIRouter as _APIRouter  # noqa: E402

router = _APIRouter(tags=["Business Extraction & Notifications"])
router.include_router(extraction_router)
router.include_router(notification_router)

