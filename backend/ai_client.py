"""
Xccelera AI-SDLC Platform — AI client (Groq).

All functions fall back to realistic mock data when:
  - GROQ_API_KEY is not set / empty.
  - The API call raises an exception.
  - The model response cannot be parsed as JSON.

Model: llama-3.3-70b-versatile (Groq)  |  max_tokens: 4096
"""

import json
import logging
import os
from typing import Any

from groq import AsyncGroq

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY", ""))

_MODEL = "llama-3.3-70b-versatile"
_MAX_TOKENS = 4096


def _has_key() -> bool:
    """Return True when a non-empty API key is configured."""
    key = os.getenv("GROQ_API_KEY", "")
    return bool(key and key.strip())


async def _call(system: str, user: str) -> str:
    """
    Thin wrapper around the Groq chat completions API.
    Returns the text content of the first choice.
    """
    response = await client.chat.completions.create(
        model=_MODEL,
        max_tokens=_MAX_TOKENS,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
    )
    return response.choices[0].message.content


def _parse_json(text: str, fallback: Any) -> Any:
    """
    Attempt to extract and parse a JSON block from *text*.

    Strips optional ```json … ``` fences before parsing.
    Returns *fallback* if parsing fails.
    """
    try:
        # Strip markdown code fences if present
        cleaned = text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            # Remove first and last fence lines
            start = 1
            end = len(lines) - 1 if lines[-1].strip().startswith("```") else len(lines)
            cleaned = "\n".join(lines[start:end])
        return json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        logger.warning("Failed to parse JSON from AI response; using fallback.")
        return fallback


# ---------------------------------------------------------------------------
# 1. generate_requirements_from_text
# ---------------------------------------------------------------------------

_MOCK_REQUIREMENTS = [
    {
        "title": "User Authentication & Authorization",
        "description": (
            "Implement secure user authentication with JWT tokens and "
            "role-based access control."
        ),
        "acceptance_criteria": [
            "Users can register with email and password",
            "Users can log in and receive a JWT token",
            "Role-based permissions are enforced on all endpoints",
            "Password reset via email works end-to-end",
        ],
        "priority": "high",
        "type": "functional",
    },
    {
        "title": "Real-time Dashboard",
        "description": (
            "Provide a live dashboard showing project KPIs, sprint progress, "
            "and AI job statuses."
        ),
        "acceptance_criteria": [
            "Dashboard updates without page reload",
            "KPIs refresh every 30 seconds",
            "Sprint burn-down chart is visible",
        ],
        "priority": "high",
        "type": "functional",
    },
    {
        "title": "AI-Driven Requirement Generation",
        "description": (
            "Allow product managers to paste business goals and receive structured "
            "requirements automatically."
        ),
        "acceptance_criteria": [
            "Input accepts free-form text up to 5000 characters",
            "Output is a list of structured requirements with acceptance criteria",
            "Generation completes within 15 seconds",
        ],
        "priority": "medium",
        "type": "functional",
    },
    {
        "title": "Audit Logging",
        "description": (
            "All user actions and AI events must be logged for compliance and debugging."
        ),
        "acceptance_criteria": [
            "Every API mutation records a timestamped audit entry",
            "Logs are retained for 90 days",
            "Admins can search and export logs",
        ],
        "priority": "medium",
        "type": "non-functional",
    },
    {
        "title": "Performance & Scalability",
        "description": (
            "The platform must handle 500 concurrent users with sub-200 ms P95 latency."
        ),
        "acceptance_criteria": [
            "P95 response time < 200 ms under 500 concurrent users",
            "Horizontal scaling is supported via Kubernetes",
            "Database connection pooling is configured",
        ],
        "priority": "high",
        "type": "non-functional",
    },
]


async def generate_requirements_from_text(business_goals: str) -> list[dict]:
    """
    Parse business goals text and return structured software requirements.

    Returns:
        List of dicts: {title, description, acceptance_criteria, priority, type}
    """
    if not _has_key():
        return _MOCK_REQUIREMENTS

    system = (
        "You are an expert business analyst for an AI-driven software development platform. "
        "Convert business goals into structured software requirements. "
        "Always respond with a valid JSON array — no prose, no markdown fences."
    )
    user = (
        f"Convert the following business goals into a JSON array of software requirements.\n\n"
        f"Each requirement must have these fields:\n"
        f"  title (str), description (str), acceptance_criteria (list[str]), "
        f"priority ('high'|'medium'|'low'), type ('functional'|'non-functional')\n\n"
        f"Business Goals:\n{business_goals}"
    )

    try:
        raw = await _call(system, user)
        return _parse_json(raw, _MOCK_REQUIREMENTS)
    except Exception as exc:
        logger.error("generate_requirements_from_text error: %s", exc)
        return _MOCK_REQUIREMENTS


# ---------------------------------------------------------------------------
# 2. generate_backlog
# ---------------------------------------------------------------------------

_MOCK_BACKLOG = [
    {
        "title": "Set up project scaffolding and CI/CD pipeline",
        "description": "Initialise the repository, configure linting, testing, and a GitHub Actions pipeline.",
        "acceptance_criteria": [
            "Repository initialised with project structure",
            "Pre-commit hooks configured",
            "CI passes on every PR",
        ],
        "priority": "high",
        "story_points": 5,
        "type": "chore",
    },
    {
        "title": "Implement JWT authentication endpoints",
        "description": "POST /auth/login and POST /auth/refresh return signed tokens.",
        "acceptance_criteria": [
            "Login returns access + refresh tokens",
            "Refresh rotates the refresh token",
            "Invalid credentials return 401",
        ],
        "priority": "high",
        "story_points": 8,
        "type": "feature",
    },
    {
        "title": "Create project CRUD endpoints",
        "description": "REST endpoints for creating, reading, updating, and deleting projects.",
        "acceptance_criteria": [
            "GET /projects returns paginated list",
            "POST /projects creates a new project",
            "PUT /projects/{id} updates fields",
            "DELETE /projects/{id} soft-deletes",
        ],
        "priority": "high",
        "story_points": 5,
        "type": "feature",
    },
    {
        "title": "Build AI requirement generation integration",
        "description": "Wire the NLP intake form to the Claude API and persist results.",
        "acceptance_criteria": [
            "POST /requirements/generate accepts free-form text",
            "Requirements are persisted with ai_generated=true",
            "Errors are surfaced to the user",
        ],
        "priority": "medium",
        "story_points": 13,
        "type": "feature",
    },
    {
        "title": "Unit tests for auth and project services",
        "description": "Achieve 80 % line coverage on auth and project service modules.",
        "acceptance_criteria": [
            "Auth service: 80 %+ coverage",
            "Project service: 80 %+ coverage",
            "Tests run in < 10 s",
        ],
        "priority": "medium",
        "story_points": 8,
        "type": "test",
    },
]


async def generate_backlog(
    requirements: list[dict], project_name: str
) -> list[dict]:
    """
    Decompose requirements into backlog items.

    Returns:
        List of dicts: {title, description, acceptance_criteria, priority, story_points, type}
    """
    if not _has_key():
        return _MOCK_BACKLOG

    system = (
        "You are an experienced agile delivery manager. "
        "Break down software requirements into development backlog items. "
        "Always respond with a valid JSON array — no prose, no markdown fences."
    )
    req_text = json.dumps(requirements, indent=2)
    user = (
        f"Project: {project_name}\n\n"
        f"Requirements:\n{req_text}\n\n"
        f"Create a JSON array of backlog items. Each item must have:\n"
        f"  title (str), description (str), acceptance_criteria (list[str]), "
        f"priority ('high'|'medium'|'low'), story_points (int 1–13), "
        f"type ('feature'|'bug'|'chore'|'test')"
    )

    try:
        raw = await _call(system, user)
        return _parse_json(raw, _MOCK_BACKLOG)
    except Exception as exc:
        logger.error("generate_backlog error: %s", exc)
        return _MOCK_BACKLOG


# ---------------------------------------------------------------------------
# 3. plan_sprint
# ---------------------------------------------------------------------------

_MOCK_SPRINT_PLAN: dict = {
    "sprint_name": "Sprint 1 — Foundation",
    "goal": "Deliver a working authentication system and core project management endpoints.",
    "recommended_items": [
        "Set up project scaffolding and CI/CD pipeline",
        "Implement JWT authentication endpoints",
        "Create project CRUD endpoints",
    ],
    "rationale": (
        "These foundational items unlock all downstream work. "
        "Combined story points (18) fit within the team velocity of 30."
    ),
}


async def plan_sprint(
    backlog_items: list[dict], velocity: int, capacity: int
) -> dict:
    """
    Recommend sprint items based on backlog, velocity, and capacity.

    Returns:
        {sprint_name, goal, recommended_items: list[str], rationale}
    """
    if not _has_key():
        return _MOCK_SPRINT_PLAN

    system = (
        "You are an expert scrum master. Select the optimal set of backlog items "
        "for the next sprint given velocity and capacity constraints. "
        "Always respond with a valid JSON object — no prose, no markdown fences."
    )
    items_text = json.dumps(backlog_items, indent=2)
    user = (
        f"Team velocity: {velocity} points/sprint. Capacity: {capacity} hours.\n\n"
        f"Backlog:\n{items_text}\n\n"
        f"Return a JSON object with:\n"
        f"  sprint_name (str), goal (str), "
        f"recommended_items (list[str] — titles only), rationale (str)"
    )

    try:
        raw = await _call(system, user)
        return _parse_json(raw, _MOCK_SPRINT_PLAN)
    except Exception as exc:
        logger.error("plan_sprint error: %s", exc)
        return _MOCK_SPRINT_PLAN


# ---------------------------------------------------------------------------
# 4. recommend_tech_stack
# ---------------------------------------------------------------------------

_MOCK_TECH_STACK: dict = {
    "frontend": ["React 18", "TypeScript", "Tailwind CSS", "Vite"],
    "backend": ["Python 3.12", "FastAPI", "SQLAlchemy", "Pydantic v2"],
    "database": ["PostgreSQL 16", "Redis 7"],
    "infrastructure": ["Docker", "Kubernetes", "GitHub Actions", "AWS ECS"],
    "rationale": (
        "React + FastAPI is a proven combination for data-intensive dashboards. "
        "PostgreSQL provides ACID guarantees; Redis handles caching and pub/sub. "
        "Kubernetes enables horizontal scaling for the stated team size and scale."
    ),
}


async def recommend_tech_stack(
    project_description: str, team_size: int, scale: str
) -> dict:
    """
    Recommend a technology stack for the project.

    Returns:
        {frontend, backend, database, infrastructure: list[str], rationale: str}
    """
    if not _has_key():
        return _MOCK_TECH_STACK

    system = (
        "You are a senior solutions architect specialising in scalable web platforms. "
        "Recommend the best technology stack for the project. "
        "Always respond with a valid JSON object — no prose, no markdown fences."
    )
    user = (
        f"Project: {project_description}\n"
        f"Team size: {team_size} engineers\n"
        f"Scale: {scale}\n\n"
        f"Return a JSON object with:\n"
        f"  frontend (list[str]), backend (list[str]), database (list[str]), "
        f"infrastructure (list[str]), rationale (str)"
    )

    try:
        raw = await _call(system, user)
        return _parse_json(raw, _MOCK_TECH_STACK)
    except Exception as exc:
        logger.error("recommend_tech_stack error: %s", exc)
        return _MOCK_TECH_STACK


# ---------------------------------------------------------------------------
# 5. generate_architecture_diagram
# ---------------------------------------------------------------------------

_MOCK_ARCHITECTURE = """graph TD
    Client["Browser / Mobile Client"]
    CDN["CDN (CloudFront)"]
    LB["Load Balancer"]
    API["FastAPI Gateway"]
    Auth["Auth Service"]
    PM["Project Manager Service"]
    AI["AI Orchestration Service"]
    DB[("PostgreSQL")]
    Cache[("Redis Cache")]
    Queue["Message Queue (Kafka)"]
    Claude["Anthropic Claude API"]

    Client --> CDN
    CDN --> LB
    LB --> API
    API --> Auth
    API --> PM
    API --> AI
    Auth --> DB
    PM --> DB
    PM --> Cache
    AI --> Queue
    AI --> Claude
    Queue --> AI
"""


async def generate_architecture_diagram(
    project_description: str, tech_stack: list
) -> str:
    """
    Generate a Mermaid architecture diagram (graph TD) for the project.

    Returns:
        Mermaid diagram string.
    """
    if not _has_key():
        return _MOCK_ARCHITECTURE

    system = (
        "You are a solutions architect. Generate a Mermaid graph TD diagram "
        "showing the high-level architecture. Output ONLY the raw Mermaid code — "
        "no explanation, no markdown fences."
    )
    stack_str = ", ".join(tech_stack) if tech_stack else "not specified"
    user = (
        f"Project: {project_description}\n"
        f"Tech stack: {stack_str}\n\n"
        f"Generate a Mermaid graph TD architecture diagram."
    )

    try:
        raw = await _call(system, user)
        return raw.strip()
    except Exception as exc:
        logger.error("generate_architecture_diagram error: %s", exc)
        return _MOCK_ARCHITECTURE


# ---------------------------------------------------------------------------
# 6. generate_api_contract
# ---------------------------------------------------------------------------

_MOCK_API_CONTRACT = """openapi: "3.1.0"
info:
  title: Example Service API
  version: "1.0.0"
paths:
  /items:
    get:
      summary: List items
      responses:
        "200":
          description: A list of items
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Item"
    post:
      summary: Create item
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ItemCreate"
      responses:
        "201":
          description: Item created
components:
  schemas:
    Item:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
    ItemCreate:
      type: object
      required: [name]
      properties:
        name:
          type: string
"""


async def generate_api_contract(service_name: str, requirements: list[str]) -> str:
    """
    Generate an OpenAPI YAML contract for the given service.

    Returns:
        OpenAPI YAML string.
    """
    if not _has_key():
        return _MOCK_API_CONTRACT

    system = (
        "You are an API design expert. Generate a complete OpenAPI 3.1.0 YAML spec. "
        "Output ONLY the raw YAML — no explanation, no markdown fences."
    )
    reqs_text = "\n".join(f"- {r}" for r in requirements)
    user = (
        f"Service name: {service_name}\n\n"
        f"Requirements:\n{reqs_text}\n\n"
        f"Generate a complete OpenAPI 3.1.0 YAML specification."
    )

    try:
        raw = await _call(system, user)
        return raw.strip()
    except Exception as exc:
        logger.error("generate_api_contract error: %s", exc)
        return _MOCK_API_CONTRACT


# ---------------------------------------------------------------------------
# 7. generate_test_cases
# ---------------------------------------------------------------------------

_MOCK_TEST_CASES = [
    {
        "title": "Happy-path login with valid credentials",
        "type": "integration",
        "steps": [
            "POST /auth/login with valid email and password",
            "Assert HTTP 200",
            "Assert response contains access_token and refresh_token",
        ],
        "expected_result": "User receives valid JWT tokens",
        "priority": "high",
    },
    {
        "title": "Login fails with wrong password",
        "type": "integration",
        "steps": [
            "POST /auth/login with valid email and wrong password",
            "Assert HTTP 401",
        ],
        "expected_result": "401 Unauthorized with descriptive error",
        "priority": "high",
    },
    {
        "title": "Unit test: hash_password produces bcrypt hash",
        "type": "unit",
        "steps": [
            "Call hash_password('test123')",
            "Assert result starts with '$2b$'",
            "Assert verify_password('test123', result) is True",
        ],
        "expected_result": "Password is correctly hashed and verifiable",
        "priority": "medium",
    },
]


async def generate_test_cases(
    requirement_title: str,
    requirement_description: str,
    acceptance_criteria: list,
) -> list[dict]:
    """
    Generate test cases for a requirement.

    Returns:
        List of {title, type, steps, expected_result, priority}
    """
    if not _has_key():
        return _MOCK_TEST_CASES

    system = (
        "You are a QA engineer. Generate thorough test cases covering unit, "
        "integration, and edge-case scenarios. "
        "Always respond with a valid JSON array — no prose, no markdown fences."
    )
    criteria_text = "\n".join(f"- {c}" for c in acceptance_criteria)
    user = (
        f"Requirement: {requirement_title}\n\n"
        f"Description: {requirement_description}\n\n"
        f"Acceptance Criteria:\n{criteria_text}\n\n"
        f"Return a JSON array of test cases. Each must have:\n"
        f"  title (str), type ('unit'|'integration'|'e2e'), "
        f"steps (list[str]), expected_result (str), priority ('high'|'medium'|'low')"
    )

    try:
        raw = await _call(system, user)
        return _parse_json(raw, _MOCK_TEST_CASES)
    except Exception as exc:
        logger.error("generate_test_cases error: %s", exc)
        return _MOCK_TEST_CASES


# ---------------------------------------------------------------------------
# 8. generate_code
# ---------------------------------------------------------------------------

_MOCK_FASTAPI_CODE = '''"""
Auto-generated FastAPI service by Xccelera APIx Engine.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db

router = APIRouter(prefix="/generated", tags=["generated"])


@router.get("/")
async def list_items(db: AsyncSession = Depends(get_db)):
    """List all items."""
    return {"items": [], "total": 0}


@router.post("/")
async def create_item(payload: dict, db: AsyncSession = Depends(get_db)):
    """Create a new item."""
    return {"id": "new-uuid", **payload}
'''

_MOCK_REACT_CODE = '''import React, { useState, useEffect } from "react";

interface Item {
  id: string;
  name: string;
}

const GeneratedComponent: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/generated")
      .then((res) => res.json())
      .then((data) => setItems(data.items))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading…</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Generated Component</h1>
      <ul>
        {items.map((item) => (
          <li key={item.id} className="py-2 border-b">
            {item.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default GeneratedComponent;
'''


async def generate_code(
    requirement: str, tech_stack: str, engine: str
) -> str:
    """
    Generate source code for a requirement.

    Args:
        requirement: Plain-text description of what to implement.
        tech_stack: E.g. "Python, FastAPI, SQLAlchemy".
        engine: ``"apix"`` for backend Python/FastAPI, ``"uix"`` for React frontend.

    Returns:
        Source code string.
    """
    if engine == "apix":
        mock = _MOCK_FASTAPI_CODE
        lang = "Python FastAPI"
    else:
        mock = _MOCK_REACT_CODE
        lang = "React TypeScript"

    if not _has_key():
        return mock

    system = (
        f"You are an expert {lang} developer. "
        f"Generate production-quality {lang} code with docstrings, type hints, "
        f"and error handling. Output ONLY the raw code — no explanation."
    )
    user = (
        f"Requirement: {requirement}\n"
        f"Tech stack: {tech_stack}\n\n"
        f"Generate complete, runnable {lang} code that satisfies the requirement."
    )

    try:
        raw = await _call(system, user)
        return raw.strip()
    except Exception as exc:
        logger.error("generate_code error: %s", exc)
        return mock


# ---------------------------------------------------------------------------
# 9. analyze_conflicts
# ---------------------------------------------------------------------------

_MOCK_CONFLICTS: list[dict] = [
    {
        "req1_id": "req-001",
        "req2_id": "req-003",
        "conflict_description": (
            "REQ-001 requires strict input validation (max 100 chars) while "
            "REQ-003 allows free-form text up to 5000 characters — these overlap."
        ),
        "severity": "medium",
    }
]


async def analyze_conflicts(requirements: list[dict]) -> list[dict]:
    """
    Detect conflicts and inconsistencies across requirements.

    Returns:
        List of {req1_id, req2_id, conflict_description, severity}
    """
    if not _has_key():
        return _MOCK_CONFLICTS

    system = (
        "You are a requirements analyst specialising in conflict detection. "
        "Identify contradictions, overlaps, and ambiguities in the requirements. "
        "Always respond with a valid JSON array — no prose, no markdown fences."
    )
    reqs_text = json.dumps(requirements, indent=2)
    user = (
        f"Analyse the following requirements for conflicts:\n\n{reqs_text}\n\n"
        f"Return a JSON array of conflicts. Each must have:\n"
        f"  req1_id (str), req2_id (str), conflict_description (str), "
        f"severity ('high'|'medium'|'low')"
    )

    try:
        raw = await _call(system, user)
        return _parse_json(raw, _MOCK_CONFLICTS)
    except Exception as exc:
        logger.error("analyze_conflicts error: %s", exc)
        return _MOCK_CONFLICTS


# ---------------------------------------------------------------------------
# 10. generate_release_notes
# ---------------------------------------------------------------------------

_MOCK_RELEASE_NOTES = """# Release Notes — v1.0.0

## What's New
- Initial release of the Xccelera AI-SDLC Platform
- JWT-based authentication with refresh token rotation
- Project and requirement management APIs
- AI-driven requirement generation via Claude

## Bug Fixes
- N/A (initial release)

## Breaking Changes
- N/A (initial release)
"""


async def generate_release_notes(commits: list[str], version: str) -> str:
    """
    Generate markdown release notes from a list of commit messages.

    Returns:
        Markdown string.
    """
    if not _has_key():
        return _MOCK_RELEASE_NOTES

    system = (
        "You are a technical writer. Generate clear, user-facing release notes "
        "from git commit messages. Use markdown with headers: What's New, Bug Fixes, "
        "Breaking Changes. Output ONLY the raw markdown."
    )
    commits_text = "\n".join(f"- {c}" for c in commits)
    user = (
        f"Version: {version}\n\n"
        f"Commits:\n{commits_text}\n\n"
        f"Generate release notes in markdown format."
    )

    try:
        raw = await _call(system, user)
        return raw.strip()
    except Exception as exc:
        logger.error("generate_release_notes error: %s", exc)
        return _MOCK_RELEASE_NOTES


# ---------------------------------------------------------------------------
# 11. extract_business_logic
# ---------------------------------------------------------------------------

_MOCK_EXTRACTION: dict = {
    "business_rules": [
        "A user must belong to exactly one organisation",
        "Only admins may delete projects",
        "Sprint capacity cannot exceed team velocity × 2",
    ],
    "process_flows": [
        "User registration → email verification → onboarding wizard → dashboard",
        "Requirement intake → AI analysis → conflict check → approval → backlog",
    ],
    "entities": ["User", "Organisation", "Project", "Requirement", "Sprint", "AIJob"],
    "summary": (
        "The codebase implements a multi-tenant SDLC platform with AI-driven "
        "requirement analysis, sprint planning, and automated testing."
    ),
}


async def extract_business_logic(code_snippet: str) -> dict:
    """
    Reverse-engineer business logic from source code.

    Returns:
        {business_rules: list[str], process_flows: list[str], entities: list[str], summary: str}
    """
    if not _has_key():
        return _MOCK_EXTRACTION

    system = (
        "You are a senior software analyst. Extract the business logic from the "
        "provided source code. Always respond with a valid JSON object — no prose, "
        "no markdown fences."
    )
    user = (
        f"Analyse this source code and extract business logic:\n\n```\n{code_snippet}\n```\n\n"
        f"Return a JSON object with:\n"
        f"  business_rules (list[str]), process_flows (list[str]), "
        f"entities (list[str]), summary (str)"
    )

    try:
        raw = await _call(system, user)
        return _parse_json(raw, _MOCK_EXTRACTION)
    except Exception as exc:
        logger.error("extract_business_logic error: %s", exc)
        return _MOCK_EXTRACTION


# ---------------------------------------------------------------------------
# 12. convert_legacy_code
# ---------------------------------------------------------------------------

_MOCK_CONVERTED_CODE = """# Converted by Xccelera Legacy Modernisation Engine
# Original: COBOL  →  Target: Python

def calculate_total(quantity: int, unit_price: float) -> float:
    \"\"\"Calculate order total with tax.\"\"\"
    subtotal = quantity * unit_price
    tax = subtotal * 0.1
    return subtotal + tax
"""


async def convert_legacy_code(
    source_code: str, source_lang: str, target_lang: str
) -> str:
    """
    Modernise legacy code from *source_lang* to *target_lang*.

    Returns:
        Converted source code string.
    """
    if not _has_key():
        return _MOCK_CONVERTED_CODE

    system = (
        f"You are an expert software modernisation engineer. "
        f"Convert {source_lang} code to idiomatic, production-quality {target_lang}. "
        f"Preserve all logic and add docstrings. Output ONLY raw code."
    )
    user = (
        f"Convert the following {source_lang} code to {target_lang}:\n\n"
        f"```{source_lang}\n{source_code}\n```"
    )

    try:
        raw = await _call(system, user)
        return raw.strip()
    except Exception as exc:
        logger.error("convert_legacy_code error: %s", exc)
        return _MOCK_CONVERTED_CODE


# ---------------------------------------------------------------------------
# 13. generate_agent
# ---------------------------------------------------------------------------

_MOCK_AGENT: dict = {
    "name": "xccelera-general-agent",
    "code": (
        "class XcceleraAgent:\n"
        '    """Auto-generated agent scaffold."""\n\n'
        "    def __init__(self, tools: list):\n"
        "        self.tools = tools\n\n"
        "    async def run(self, task: str) -> str:\n"
        '        return f"Agent executing: {task}"\n'
    ),
    "capabilities": [
        "requirement_analysis",
        "code_generation",
        "test_generation",
    ],
    "tools": ["claude_api", "github_api", "jira_api"],
    "behavioral_rules": [
        "Always ask for clarification before destructive operations",
        "Respect rate limits on all external APIs",
        "Log all actions to the MEE event stream",
    ],
}


async def generate_agent(spec: str, template: str) -> dict:
    """
    Generate an autonomous agent definition from a specification.

    Returns:
        {name, code, capabilities: list[str], tools: list[str], behavioral_rules: list[str]}
    """
    if not _has_key():
        return _MOCK_AGENT

    system = (
        "You are an expert AI agent designer. Generate a complete agent definition "
        "from the specification. Always respond with a valid JSON object — "
        "no prose, no markdown fences."
    )
    user = (
        f"Template: {template}\n\n"
        f"Specification:\n{spec}\n\n"
        f"Return a JSON object with:\n"
        f"  name (str), code (str — Python class), capabilities (list[str]), "
        f"tools (list[str]), behavioral_rules (list[str])"
    )

    try:
        raw = await _call(system, user)
        return _parse_json(raw, _MOCK_AGENT)
    except Exception as exc:
        logger.error("generate_agent error: %s", exc)
        return _MOCK_AGENT
