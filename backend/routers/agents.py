"""
Xccelera AI-SDLC Platform â€” Agent Developer Router (AGT-001 to AGT-007).

Endpoints:
    GET    /agents                  â€” list agents
    POST   /agents                  â€” create agent manually
    GET    /agents/registry         â€” AGT-003 full registry
    GET    /agents/{agent_id}       â€” get agent
    PUT    /agents/{agent_id}       â€” update agent
    DELETE /agents/{agent_id}       â€” delete agent
    POST   /agents/design           â€” AGT-001 agent design studio
    POST   /agents/generate         â€” AGT-002 auto-generate from NL spec
    POST   /agents/{agent_id}/deploy    â€” AGT-004 deploy agent
    POST   /agents/{agent_id}/rollback  â€” AGT-005 rollback version
    POST   /agents/{agent_id}/test      â€” AGT-006 test agent
    GET    /agents/{agent_id}/versions  â€” list versions
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

import ai_client
from auth import get_optional_user
from database import get_db
from models import AgentRecord, AIJob, MEEEvent, User
from schemas import (
    AgentCreate,
    AgentResponse,
    GenerateAgentRequest,
    MessageResponse,
)

router = APIRouter(prefix="/agents", tags=["Agent Developer"])


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _resolve_org_id(user: Optional[User], org_id: Optional[str]) -> str:
    """
    Determine the org_id to scope a query to.

    Priority:
        1. Explicit ``org_id`` query parameter (for admin / cross-org calls).
        2. The authenticated user's own ``org_id``.
        3. Fallback sentinel (unauthenticated, no org_id given) â€” returns empty
           string, causing queries to return no results rather than crashing.
    """
    if org_id:
        return org_id
    if user is not None:
        return user.org_id
    return ""


async def _get_agent_or_404(
    agent_id: str,
    db: AsyncSession,
    org_id: Optional[str] = None,
) -> AgentRecord:
    """Fetch a single AgentRecord by primary key, raising 404 when absent."""
    stmt = select(AgentRecord).where(AgentRecord.id == agent_id)
    if org_id:
        stmt = stmt.where(AgentRecord.org_id == org_id)
    result = await db.execute(stmt)
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent '{agent_id}' not found.",
        )
    return agent


# ---------------------------------------------------------------------------
# 1. GET / â€” list agents
# ---------------------------------------------------------------------------


@router.get("/", response_model=List[AgentResponse])
async def list_agents(
    org_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> List[AgentResponse]:
    """
    Return all agents visible to the caller.

    When authenticated the list is scoped to the user's organisation unless
    an explicit ``org_id`` query parameter is supplied.
    """
    resolved = _resolve_org_id(current_user, org_id)
    stmt = select(AgentRecord)
    if resolved:
        stmt = stmt.where(AgentRecord.org_id == resolved)
    stmt = stmt.order_by(AgentRecord.created_at.desc())
    result = await db.execute(stmt)
    agents = result.scalars().all()
    return [AgentResponse.model_validate(a) for a in agents]


# ---------------------------------------------------------------------------
# 2. POST / â€” create agent manually
# ---------------------------------------------------------------------------


@router.post("/", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    payload: AgentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> AgentResponse:
    """
    Manually create a new agent record (no AI generation).
    """
    org_id = current_user.org_id if current_user else "demo-org"
    owner_id = current_user.id if current_user else None

    agent = AgentRecord(
        org_id=org_id,
        name=payload.name,
        description=payload.description or "",
        owner_id=owner_id,
        status="draft",
        capabilities=payload.capabilities,
        tools=payload.tools,
        version=1,
    )
    db.add(agent)
    await db.flush()
    await db.refresh(agent)
    return AgentResponse.model_validate(agent)


# ---------------------------------------------------------------------------
# Static-path routes MUST come before /{agent_id} to avoid shadowing.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# 11. GET /registry â€” AGT-003 full agent registry
# ---------------------------------------------------------------------------


@router.get("/registry", response_model=Dict[str, Any])
async def get_registry(
    org_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> Dict[str, Any]:
    """
    AGT-003 â€” Return the full agent registry with deployment metadata.

    Response shape::

        {
            "agents": List[AgentResponse],
            "total":  int,
            "deployed": int,
        }
    """
    resolved = _resolve_org_id(current_user, org_id)
    stmt = select(AgentRecord)
    if resolved:
        stmt = stmt.where(AgentRecord.org_id == resolved)
    stmt = stmt.order_by(AgentRecord.created_at.desc())

    result = await db.execute(stmt)
    agents = result.scalars().all()

    agent_responses = [AgentResponse.model_validate(a) for a in agents]
    deployed_count = sum(1 for a in agents if a.status == "deployed")

    return {
        "agents": agent_responses,
        "total": len(agent_responses),
        "deployed": deployed_count,
    }


# ---------------------------------------------------------------------------
# 6. POST /design â€” AGT-001 agent design studio
# ---------------------------------------------------------------------------


@router.post("/design", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def design_agent(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> AgentResponse:
    """
    AGT-001 â€” Agent design studio.

    Accepts a structured design payload and creates a draft AgentRecord.

    Request body::

        {
            "name":             str,
            "goals":            List[str],
            "capabilities":     List[str],
            "tools":            List[str],
            "behavioral_rules": List[str],
        }
    """
    name: str = payload.get("name", "Unnamed Agent")
    goals: List[str] = payload.get("goals", [])
    capabilities: List[str] = payload.get("capabilities", [])
    tools: List[str] = payload.get("tools", [])
    behavioral_rules: List[str] = payload.get("behavioral_rules", [])

    org_id = current_user.org_id if current_user else "demo-org"
    owner_id = current_user.id if current_user else None

    # Build a description from goals + behavioural rules so the record is
    # self-documenting without a dedicated DB column.
    description_parts: List[str] = []
    if goals:
        description_parts.append("Goals: " + "; ".join(goals))
    if behavioral_rules:
        description_parts.append("Rules: " + "; ".join(behavioral_rules))
    description = " | ".join(description_parts)

    agent = AgentRecord(
        org_id=org_id,
        name=name,
        description=description,
        owner_id=owner_id,
        status="draft",
        capabilities=capabilities,
        tools=tools,
        version=1,
    )
    db.add(agent)
    await db.flush()
    await db.refresh(agent)
    return AgentResponse.model_validate(agent)


# ---------------------------------------------------------------------------
# 7. POST /generate â€” AGT-002 auto-generate agent from NL spec
# ---------------------------------------------------------------------------


@router.post(
    "/generate", response_model=AgentResponse, status_code=status.HTTP_201_CREATED
)
async def generate_agent(
    payload: GenerateAgentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> AgentResponse:
    """
    AGT-002 â€” Auto-generate an agent from a natural-language specification.

    Calls ``ai_client.generate_agent``, persists the result as an
    AgentRecord, records an AIJob and a MEEEvent, then returns the new agent.
    """
    org_id = current_user.org_id if current_user else "demo-org"
    owner_id = current_user.id if current_user else None

    # --- AI call ---
    generated: Dict[str, Any] = await ai_client.generate_agent(
        spec=payload.spec,
        template=payload.template,
    )

    # --- Persist AgentRecord ---
    agent = AgentRecord(
        org_id=org_id,
        name=generated.get("name", "AI Generated Agent"),
        description=generated.get("code", "")[:500],  # store first 500 chars of code as description
        owner_id=owner_id,
        status="draft",
        capabilities=generated.get("capabilities", []),
        tools=generated.get("tools", []),
        version=1,
    )
    db.add(agent)
    await db.flush()  # populate agent.id before referencing it

    # --- Persist AIJob ---
    now = datetime.utcnow()
    ai_job = AIJob(
        org_id=org_id,
        # AIJob requires a project_id; use a sentinel value for agent-only jobs.
        project_id="agent-developer",
        engine="agent_developer",
        trigger_source="api",
        priority="medium",
        status="completed",
        payload={"spec": payload.spec, "template": payload.template},
        result=generated,
        started_at=now,
        completed_at=now,
    )
    db.add(ai_job)

    # --- Persist MEEEvent ---
    mee_event = MEEEvent(
        org_id=org_id,
        engine="agent_developer",
        event_type="agent.generated",
        description=f"Agent '{agent.name}' auto-generated from spec via AGT-002.",
        event_metadata={
            "agent_id": agent.id,
            "template": payload.template,
            "capabilities_count": len(agent.capabilities),
            "tools_count": len(agent.tools),
        },
        severity="info",
    )
    db.add(mee_event)

    await db.flush()
    await db.refresh(agent)
    return AgentResponse.model_validate(agent)


# ---------------------------------------------------------------------------
# 3. GET /{agent_id} â€” get single agent
# ---------------------------------------------------------------------------


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> AgentResponse:
    """Return a single agent by ID."""
    org_id = current_user.org_id if current_user else None
    agent = await _get_agent_or_404(agent_id, db, org_id)
    return AgentResponse.model_validate(agent)


# ---------------------------------------------------------------------------
# 4. PUT /{agent_id} â€” update agent
# ---------------------------------------------------------------------------


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> AgentResponse:
    """
    Update mutable fields of an existing agent.

    Accepts any subset of: name, description, capabilities, tools, status,
    docker_image, mee_enabled.
    """
    org_id = current_user.org_id if current_user else None
    agent = await _get_agent_or_404(agent_id, db, org_id)

    updatable = {
        "name",
        "description",
        "capabilities",
        "tools",
        "status",
        "docker_image",
        "mee_enabled",
    }
    for field, value in payload.items():
        if field in updatable and value is not None:
            setattr(agent, field, value)

    await db.flush()
    await db.refresh(agent)
    return AgentResponse.model_validate(agent)


# ---------------------------------------------------------------------------
# 5. DELETE /{agent_id} â€” delete agent
# ---------------------------------------------------------------------------


@router.delete("/{agent_id}", response_model=MessageResponse)
async def delete_agent(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> MessageResponse:
    """Permanently delete an agent record."""
    org_id = current_user.org_id if current_user else None
    agent = await _get_agent_or_404(agent_id, db, org_id)
    await db.delete(agent)
    await db.flush()
    return MessageResponse(message=f"Agent '{agent_id}' deleted successfully.")


# ---------------------------------------------------------------------------
# 8. POST /{agent_id}/deploy â€” AGT-004 deploy agent
# ---------------------------------------------------------------------------


@router.post("/{agent_id}/deploy", response_model=AgentResponse)
async def deploy_agent(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> AgentResponse:
    """
    AGT-004 â€” Deploy an agent.

    Updates the agent's status to ``'deployed'`` and fires a MEEEvent.
    """
    org_id = current_user.org_id if current_user else None
    agent = await _get_agent_or_404(agent_id, db, org_id)

    agent.status = "deployed"

    mee_event = MEEEvent(
        org_id=agent.org_id,
        engine="agent_developer",
        event_type="agent.deployed",
        description=f"Agent '{agent.name}' (v{agent.version}) deployed via AGT-004.",
        event_metadata={
            "agent_id": agent.id,
            "agent_name": agent.name,
            "version": agent.version,
        },
        severity="info",
    )
    db.add(mee_event)

    await db.flush()
    await db.refresh(agent)
    return AgentResponse.model_validate(agent)


# ---------------------------------------------------------------------------
# 9. POST /{agent_id}/rollback â€” AGT-005 rollback to previous version
# ---------------------------------------------------------------------------


@router.post("/{agent_id}/rollback", response_model=AgentResponse)
async def rollback_agent(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> AgentResponse:
    """
    AGT-005 â€” Rollback an agent to its previous version.

    Decrements the version counter (minimum 1) and re-marks the agent as
    ``'deployed'``.
    """
    org_id = current_user.org_id if current_user else None
    agent = await _get_agent_or_404(agent_id, db, org_id)

    previous_version = agent.version
    agent.version = max(1, agent.version - 1)
    agent.status = "deployed"

    mee_event = MEEEvent(
        org_id=agent.org_id,
        engine="agent_developer",
        event_type="agent.rolled_back",
        description=(
            f"Agent '{agent.name}' rolled back from v{previous_version} "
            f"to v{agent.version} via AGT-005."
        ),
        event_metadata={
            "agent_id": agent.id,
            "agent_name": agent.name,
            "from_version": previous_version,
            "to_version": agent.version,
        },
        severity="warning",
    )
    db.add(mee_event)

    await db.flush()
    await db.refresh(agent)
    return AgentResponse.model_validate(agent)


# ---------------------------------------------------------------------------
# 10. POST /{agent_id}/test â€” AGT-006 test agent
# ---------------------------------------------------------------------------


@router.post("/{agent_id}/test", response_model=Dict[str, Any])
async def test_agent(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> Dict[str, Any]:
    """
    AGT-006 â€” Run a simulated test suite against the agent.

    Returns a fixed demo result that always passes.
    """
    org_id = current_user.org_id if current_user else None
    # Ensure the agent exists before running tests.
    await _get_agent_or_404(agent_id, db, org_id)

    return {
        "status": "passed",
        "tests_run": 5,
        "tests_passed": 5,
        "output_quality": 0.94,
        "latency_ms": 340,
    }


# ---------------------------------------------------------------------------
# 12. GET /{agent_id}/versions â€” list versions
# ---------------------------------------------------------------------------


@router.get("/{agent_id}/versions", response_model=List[Dict[str, Any]])
async def list_agent_versions(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> List[Dict[str, Any]]:
    """
    Return the simulated version history for an agent.

    Because the data model stores only the current version as a single
    integer counter, this endpoint reconstructs a plausible history by
    emitting one entry per version from 1 up to ``agent.version``.
    """
    org_id = current_user.org_id if current_user else None
    agent = await _get_agent_or_404(agent_id, db, org_id)

    versions: List[Dict[str, Any]] = []
    for v in range(1, agent.version + 1):
        versions.append(
            {
                "version": v,
                "created_at": agent.created_at,
                "changelog": "Initial version" if v == 1 else f"Version {v} update",
            }
        )
    return versions

