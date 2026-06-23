# Xccelera AI-Driven SDLC Platform

> Central orchestration hub for the full Software Development Life Cycle, powered by 8 proprietary AI engines.

**SRS v1.1 · System Design v1.0 · Phase 1 MVP target: 9 months**

---

## Overview

The platform manages and automates every SDLC phase — from natural-language requirement intake through AI code generation, automated testing, CI/CD deployment, and tamper-proof evidence capture — via a layered, event-driven microservices architecture.

### AI Engines Integrated

| Engine | Role |
|---|---|
| **APIx** | Backend code generation (REST/GraphQL APIs, DB logic) |
| **UIx** | Frontend component and page generation |
| **IntegrationX** | Frontend–backend wiring and contract validation |
| **Mobile AI** | iOS & Android native app generation |
| **MEE** | Monitoring & Evidence Engine — immutable agent audit trail |
| **Agent Developer** | Custom AI agent design, generation, and deployment |
| **Legacy Code Converter** | COBOL/FORTRAN/VB6 → Java/.NET/Python |
| **Business Extraction Tool** | Codebase → BRD, process flows, domain wiki |

---

## Repository Structure

```
xccelera-platform/
├── services/                   # 13 backend microservices (FastAPI / Python)
│   ├── auth-service/           # User, RBAC, SSO, MFA
│   ├── project-service/        # Projects, backlogs, sprints
│   ├── requirement-service/    # NLP intake, traceability, conflict detection
│   ├── design-service/         # Tech stack, diagrams, API contracts
│   ├── ai-orchestration-service/  # Job routing to all AI engines
│   ├── test-management-service/   # Test gen, execution, coverage
│   ├── devops-service/         # CI/CD pipelines, deployments, rollback
│   ├── mee-service/            # Evidence capture, anomaly detection
│   ├── analytics-service/      # KPIs, velocity, burndown
│   ├── notification-service/   # Slack/Teams/email/in-app
│   ├── agent-developer-service/   # Agent studio, registry, deployment
│   ├── legacy-conversion-service/ # Legacy code ingestion & conversion jobs
│   └── business-extraction-service/ # BRD, process flow, domain wiki
│
├── ai-engines/                 # Adapter layer for each AI engine
│   ├── apix-adapter/
│   ├── uix-adapter/
│   ├── integrationx-adapter/
│   ├── mobile-ai-adapter/
│   ├── agent-developer-adapter/
│   ├── legacy-converter-adapter/
│   └── business-extractor-adapter/
│
├── frontend/
│   └── web-app/               # Next.js 14 (App Router)
│
├── infrastructure/
│   ├── terraform/             # IaC — EKS, RDS, ElastiCache, S3, MSK
│   ├── kubernetes/            # K8s manifests (5 namespaces)
│   └── helm/                  # Helm chart for full platform
│
├── shared/
│   ├── common-models/         # Shared Pydantic models & enums
│   └── event-schemas/         # Kafka event JSON schemas
│
├── integrations/              # Third-party adapter services
│   ├── github-adapter/
│   ├── jira-adapter/
│   ├── slack-adapter/
│   ├── cloud-providers/
│   └── llm-proxy/             # LiteLLM-based unified LLM router
│
├── data/
│   ├── postgres/migrations/   # Flyway SQL migrations
│   ├── mongodb/indexes/       # MongoDB index definitions
│   ├── kafka/                 # Topic configuration
│   ├── redis/                 # Redis config
│   └── elasticsearch/        # Index templates
│
├── security/
│   ├── vault/policies/        # HashiCorp Vault policies
│   └── rbac/                  # Role & permission definitions
│
├── tests/
│   ├── e2e/                   # Playwright end-to-end tests
│   ├── integration/           # Cross-service integration tests
│   └── load/k6/               # k6 load test scripts
│
├── docs/
│   ├── architecture/          # Architecture docs & ADRs
│   ├── api/                   # OpenAPI specs (one per service)
│   └── runbooks/              # Operational runbooks
│
├── scripts/                   # Developer utility scripts
├── .github/workflows/         # GitHub Actions CI/CD
├── docker-compose.yml         # Full local dev stack
├── docker-compose.infra.yml   # Infrastructure services only
└── .env.example               # Required environment variables
```

---

## Quick Start (Local Development)

### Prerequisites
- Docker Desktop 4.x+
- Python 3.11+
- Node.js 20+
- kubectl + Helm 3

### Spin up infrastructure
```bash
cp .env.example .env
docker compose -f docker-compose.infra.yml up -d
```

### Run all services
```bash
docker compose up -d
```

### Run a single service (example: project-service)
```bash
cd services/project-service
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8002
```

---

## Architecture Summary

| Layer | Technology |
|---|---|
| API Gateway | Kong / AWS API Gateway |
| Auth | OAuth 2.0 + SAML 2.0, TOTP/FIDO2 MFA, short-lived JWTs |
| Service Mesh | Istio (mTLS between all services) |
| Event Bus | Apache Kafka |
| Structured Data | PostgreSQL (schema-per-tenant) |
| Documents / Audit | MongoDB (append-only MEE collection) |
| Search | Elasticsearch |
| Cache / Sessions | Redis |
| Metrics | InfluxDB / TimescaleDB |
| Artifacts | S3-compatible object store |
| Secrets | HashiCorp Vault |
| Container Orchestration | Kubernetes (EKS / GKE / AKS) |
| IaC | Terraform |
| GitOps | ArgoCD |
| Observability | Prometheus + Grafana + Datadog |

---

## Kubernetes Namespaces

| Namespace | Contents |
|---|---|
| `system` | API Gateway, Auth Service, Vault Agent |
| `platform` | All 13 core microservices |
| `ai` | AI engine adapters, custom agent pods |
| `data` | Kafka, Redis (external managed DBs: RDS, Atlas) |
| `monitoring` | Prometheus, Grafana, Datadog agent |

---

## Phase 1 MVP Milestones

| Phase | Months | Focus |
|---|---|---|
| Foundation | 1–3 | Infrastructure, Auth, Project/Requirement/Backlog, MEE audit logging, GitHub integration |
| AI Engines | 4–6 | AI Orchestration, APIx, UIx, IntegrationX, Mobile AI, Agent Developer |
| Quality & Delivery | 7–9 | Test Management, CI/CD, full MEE, Analytics, Legacy Conversion, BET, pentest, load test, UAT |

> **Critical path**: All 5 core AI engines (APIx, UIx, IntegrationX, Mobile AI, MEE) must be connected before Phase 1 launch.

---

## Open Architecture Decisions

See [`docs/architecture/adr/`](docs/architecture/adr/) for recorded decisions on:
- ADR-001: Kafka vs RabbitMQ
- ADR-002: LLM routing strategy (LiteLLM proxy)
- ADR-003: Multi-tenancy DB isolation (schema-per-tenant)
- ADR-004: IntegrationX trigger timeout policy

---

## Service Port Map (Local)

| Service | Port |
|---|---|
| API Gateway | 8000 |
| auth-service | 8001 |
| project-service | 8002 |
| requirement-service | 8003 |
| design-service | 8004 |
| ai-orchestration-service | 8005 |
| test-management-service | 8006 |
| devops-service | 8007 |
| mee-service | 8008 |
| analytics-service | 8009 |
| notification-service | 8010 |
| agent-developer-service | 8011 |
| legacy-conversion-service | 8012 |
| business-extraction-service | 8013 |
| frontend (Next.js) | 3000 |

---

## Contributing

See [docs/runbooks/local-development.md](docs/runbooks/local-development.md) for the full development guide.
