"""
Xccelera AI-SDLC Platform — Design & Architecture router.

Endpoints (DES-001 through DES-005):
    POST /design/tech-stack/recommend       — DES-001
    POST /design/architecture/generate      — DES-002
    POST /design/api-contract/generate      — DES-003
    POST /design/database-schema/generate   — DES-005
    POST /design/review                     — DES-004
    GET  /design/artifacts/{project_id}     — list artifacts for a project
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import List, Optional

from anthropic import AsyncAnthropic
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import ai_client
from auth import get_optional_user
from database import get_db
from models import DesignArtifact
from schemas import (
    ArchitectureRequest,
    APIContractRequest,
    DBSchemaRequest,
    DesignResponse,
    DesignReviewRequest,
    TechStackRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/design", tags=["Design & Architecture"])

# ---------------------------------------------------------------------------
# Inline Anthropic client for DB-schema and review endpoints
# ---------------------------------------------------------------------------

_anthropic = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
_MODEL = "claude-sonnet-4-6"
_MAX_TOKENS = 4096

# ---------------------------------------------------------------------------
# Mock fallbacks for inline calls
# ---------------------------------------------------------------------------

_MOCK_DB_SCHEMA = """-- Auto-generated normalized SQL schema
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(320) NOT NULL UNIQUE,
    full_name   VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    owner_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

_MOCK_REVIEW = """## Design Review

### Strengths
- Clear separation of concerns across services.
- Consistent use of standard protocols (REST, OpenAPI).

### Concerns
- Consider adding circuit-breaker patterns for external service calls.
- Ensure all endpoints have rate-limiting configured.

### Recommendations
1. Add an API gateway layer for cross-cutting concerns.
2. Document data-flow diagrams for each bounded context.
3. Validate all inputs at the domain layer, not just at the HTTP boundary.
"""


def _has_key() -> bool:
    key = os.getenv("ANTHROPIC_API_KEY", "")
    return bool(key and key.strip())


async def _inline_call(system: str, user_msg: str) -> str:
    """Call the Anthropic API directly; returns raw text content."""
    response = await _anthropic.messages.create(
        model=_MODEL,
        max_tokens=_MAX_TOKENS,
        system=system,
        messages=[{"role": "user", "content": user_msg}],
    )
    return response.content[0].text


# ---------------------------------------------------------------------------
# DES-001 — POST /tech-stack/recommend
# ---------------------------------------------------------------------------


@router.post(
    "/tech-stack/recommend",
    response_model=DesignResponse,
    summary="DES-001: Recommend a technology stack",
)
async def recommend_tech_stack(
    request: TechStackRequest,
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_optional_user),
):
    """
    Use Claude to recommend a technology stack given a project description,
    team size, and expected scale. Persists the result as a DesignArtifact.

    Query parameter ``project_id`` associates the artifact with a project;
    falls back to a sentinel value when omitted.
    """
    result: dict = await ai_client.recommend_tech_stack(
        project_description=request.project_description,
        team_size=request.team_size,
        scale=request.scale,
    )

    # Resolve project_id: prefer query param, then a sentinel for orphan artifacts
    pid = project_id or "00000000-0000-0000-0000-000000000000"

    artifact = DesignArtifact(
        project_id=pid,
        type="tech_stack",
        content=json.dumps(result),
    )
    db.add(artifact)
    await db.flush()

    return DesignResponse(
        type="tech_stack",
        content=result,
        created_at=artifact.created_at,
    )


# ---------------------------------------------------------------------------
# DES-002 — POST /architecture/generate
# ---------------------------------------------------------------------------


@router.post(
    "/architecture/generate",
    response_model=DesignResponse,
    summary="DES-002: Generate a Mermaid architecture diagram",
)
async def generate_architecture(
    request: ArchitectureRequest,
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_optional_user),
):
    """
    Generate a Mermaid graph TD architecture diagram for the described project
    and tech stack. Persists the diagram string as a DesignArtifact.
    """
    mermaid_string: str = await ai_client.generate_architecture_diagram(
        project_description=request.project_description,
        tech_stack=request.tech_stack,
    )

    pid = project_id or "00000000-0000-0000-0000-000000000000"

    artifact = DesignArtifact(
        project_id=pid,
        type="architecture",
        content=mermaid_string,
    )
    db.add(artifact)
    await db.flush()

    return DesignResponse(
        type="architecture",
        content=mermaid_string,
        created_at=artifact.created_at,
    )


# ---------------------------------------------------------------------------
# DES-003 — POST /api-contract/generate
# ---------------------------------------------------------------------------


@router.post(
    "/api-contract/generate",
    response_model=DesignResponse,
    summary="DES-003: Generate an OpenAPI contract",
)
async def generate_api_contract(
    request: APIContractRequest,
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_optional_user),
):
    """
    Generate a complete OpenAPI 3.1.0 YAML specification for the given service
    name and functional requirements. Persists the YAML as a DesignArtifact.
    """
    yaml_string: str = await ai_client.generate_api_contract(
        service_name=request.service_name,
        requirements=request.requirements,
    )

    pid = project_id or "00000000-0000-0000-0000-000000000000"

    artifact = DesignArtifact(
        project_id=pid,
        type="api_contract",
        content=yaml_string,
    )
    db.add(artifact)
    await db.flush()

    return DesignResponse(
        type="api_contract",
        content=yaml_string,
        created_at=artifact.created_at,
    )


# ---------------------------------------------------------------------------
# DES-005 — POST /database-schema/generate
# ---------------------------------------------------------------------------


@router.post(
    "/database-schema/generate",
    response_model=DesignResponse,
    summary="DES-005: Generate a normalized SQL database schema",
)
async def generate_db_schema(
    request: DBSchemaRequest,
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_optional_user),
):
    """
    Ask Claude to generate a normalized SQL DDL schema for the listed entities.
    Persists the DDL string as a DesignArtifact.

    Falls back to a minimal mock schema when no API key is configured.
    """
    entities_list = ", ".join(request.entities)

    sql_ddl: str = _MOCK_DB_SCHEMA

    if _has_key():
        system = (
            "You are a senior database architect specialising in relational schemas. "
            "Generate a normalized, production-grade SQL DDL script (PostgreSQL dialect). "
            "Include primary keys, foreign keys, indexes, and NOT NULL constraints. "
            "Output ONLY the raw SQL — no explanation, no markdown fences."
        )
        user_msg = (
            f"Project description: {request.description}\n\n"
            f"Entities to model: {entities_list}\n\n"
            f"Generate a complete, normalized SQL DDL schema for these entities."
        )
        try:
            sql_ddl = (await _inline_call(system, user_msg)).strip()
        except Exception as exc:
            logger.error("generate_db_schema inline call failed: %s", exc)
            sql_ddl = _MOCK_DB_SCHEMA

    pid = project_id or "00000000-0000-0000-0000-000000000000"

    artifact = DesignArtifact(
        project_id=pid,
        type="db_schema",
        content=sql_ddl,
    )
    db.add(artifact)
    await db.flush()

    return DesignResponse(
        type="db_schema",
        content=sql_ddl,
        created_at=artifact.created_at,
    )


# ---------------------------------------------------------------------------
# DES-004 — POST /review
# ---------------------------------------------------------------------------


@router.post(
    "/review",
    response_model=DesignResponse,
    summary="DES-004: AI review of a design artifact",
)
async def review_design(
    request: DesignReviewRequest,
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_optional_user),
):
    """
    Send an architecture, API contract, or other design artifact to Claude for
    a structured review. Returns markdown-formatted feedback covering strengths,
    concerns, and actionable recommendations.

    Persists the review as a DesignArtifact of type ``review``.
    """
    review_text: str = _MOCK_REVIEW

    if _has_key():
        system = (
            "You are a principal software architect with deep expertise in system design. "
            "Perform a thorough, constructive review of the provided design artifact. "
            "Structure your response in markdown with sections: "
            "## Strengths, ## Concerns, ## Recommendations. "
            "Be specific and actionable. Output ONLY the markdown review."
        )
        user_msg = (
            f"Design artifact type: {request.type}\n\n"
            f"Content:\n{request.content}\n\n"
            f"Please review this design artifact and provide detailed feedback."
        )
        try:
            review_text = (await _inline_call(system, user_msg)).strip()
        except Exception as exc:
            logger.error("review_design inline call failed: %s", exc)
            review_text = _MOCK_REVIEW

    pid = project_id or "00000000-0000-0000-0000-000000000000"

    artifact = DesignArtifact(
        project_id=pid,
        type="review",
        content=review_text,
    )
    db.add(artifact)
    await db.flush()

    return DesignResponse(
        type="review",
        content=review_text,
        created_at=artifact.created_at,
    )


# ---------------------------------------------------------------------------
# GET /artifacts/{project_id}
# ---------------------------------------------------------------------------


@router.get(
    "/artifacts/{project_id}",
    response_model=List[DesignResponse],
    summary="List all design artifacts for a project",
)
async def list_design_artifacts(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_optional_user),
):
    """
    Return every DesignArtifact associated with the given project, ordered by
    creation time (newest first).
    """
    result = await db.execute(
        select(DesignArtifact)
        .where(DesignArtifact.project_id == project_id)
        .order_by(DesignArtifact.created_at.desc())
    )
    artifacts: List[DesignArtifact] = list(result.scalars().all())

    responses: List[DesignResponse] = []
    for artifact in artifacts:
        # Attempt to deserialise JSON content; fall back to raw string
        try:
            content = json.loads(artifact.content)
        except (json.JSONDecodeError, ValueError):
            content = artifact.content

        responses.append(
            DesignResponse(
                type=artifact.type,
                content=content,
                created_at=artifact.created_at,
            )
        )

    return responses
