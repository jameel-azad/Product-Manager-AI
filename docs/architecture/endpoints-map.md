# Platform Endpoints Map

Complete reference of all REST endpoints across all 13 microservices.

---

## Auth Service — Port 8001

| Method | Path | Description | SRS |
|---|---|---|---|
| POST | `/api/v1/auth/login` | Authenticate and issue JWT tokens | — |
| POST | `/api/v1/auth/logout` | Invalidate refresh token | — |
| POST | `/api/v1/auth/refresh` | Exchange refresh token for new access token | — |
| POST | `/api/v1/auth/mfa/enroll` | Initiate TOTP/FIDO2 MFA enrollment | §4.3 |
| POST | `/api/v1/auth/mfa/verify` | Verify MFA code during login | §4.3 |
| POST | `/api/v1/auth/validate` | Validate access token (internal, called by other services) | — |
| GET  | `/api/v1/auth/sso/callback` | OAuth 2.0 / SAML SSO callback | §4.3 |
| GET  | `/api/v1/users` | List users in tenant | — |
| POST | `/api/v1/users` | Create user (admin) | — |
| GET  | `/api/v1/users/{id}` | Get user by ID | — |
| PUT  | `/api/v1/users/{id}` | Update user | — |
| DELETE | `/api/v1/users/{id}` | Deactivate user | — |
| POST | `/api/v1/users/{id}/roles` | Assign role to user | — |
| GET  | `/api/v1/roles` | List roles | — |
| POST | `/api/v1/roles` | Create custom role | — |
| GET  | `/api/v1/roles/{id}` | Get role + permissions | — |
| GET  | `/api/v1/me` | Get current user profile | — |
| PUT  | `/api/v1/me` | Update current user profile | — |

---

## Project & Backlog Service — Port 8002

| Method | Path | Description | SRS |
|---|---|---|---|
| GET  | `/api/v1/projects` | List projects for tenant | — |
| POST | `/api/v1/projects` | Create project | — |
| GET  | `/api/v1/projects/{id}` | Get project | — |
| PUT  | `/api/v1/projects/{id}` | Update project | — |
| DELETE | `/api/v1/projects/{id}` | Archive project | — |
| GET  | `/api/v1/projects/{id}/backlog` | Get backlog items | — |
| POST | `/api/v1/projects/{id}/backlog/generate` | **AI: generate prioritized backlog** | PLN-002 |
| POST | `/api/v1/projects/{id}/backlog/items` | Add backlog item manually | — |
| PUT  | `/api/v1/projects/{id}/backlog/items/{item_id}` | Update backlog item | — |
| POST | `/api/v1/projects/{id}/backlog/estimate` | **AI: effort estimation** | PLN-006 |
| GET  | `/api/v1/projects/{id}/sprints` | List sprints | — |
| POST | `/api/v1/projects/{id}/sprints` | Create sprint | — |
| POST | `/api/v1/projects/{id}/sprints/plan` | **AI: sprint planning recommendation** | PLN-003 |
| GET  | `/api/v1/projects/{id}/sprints/{sprint_id}` | Get sprint detail | — |
| PUT  | `/api/v1/projects/{id}/sprints/{sprint_id}` | Update sprint | — |
| GET  | `/api/v1/projects/{id}/traceability` | **Requirement traceability matrix** | PLN-004 |

---

## Requirement Service — Port 8003

| Method | Path | Description | SRS |
|---|---|---|---|
| GET  | `/api/v1/requirements` | List requirements for project | — |
| POST | `/api/v1/requirements` | Create structured requirement | — |
| POST | `/api/v1/requirements/from-text` | **AI: NLP intake → structured requirements** | PLN-001 |
| POST | `/api/v1/requirements/analyze-conflicts` | **AI: detect conflicting requirements** | PLN-005 |
| GET  | `/api/v1/requirements/{id}` | Get requirement | — |
| PUT  | `/api/v1/requirements/{id}` | Update requirement (emits Kafka event) | APIX-005 |
| DELETE | `/api/v1/requirements/{id}` | Deprecate requirement | — |
| POST | `/api/v1/requirements/{id}/approve` | Approve requirement | — |
| GET  | `/api/v1/requirements/{id}/traceability` | Traceability chain | PLN-004 |

---

## Design & Architecture Service — Port 8004

| Method | Path | Description | SRS |
|---|---|---|---|
| POST | `/api/v1/design/tech-stack/recommend` | **AI: tech stack recommendation** | DES-001 |
| POST | `/api/v1/design/architecture/generate-diagram` | **AI: generate UML/C4/ER diagram** | DES-002 |
| GET  | `/api/v1/design/architecture/diagrams/{project_id}` | List diagrams | DES-002 |
| POST | `/api/v1/design/api-contract/generate` | **AI: generate OpenAPI contract** | DES-003 |
| GET  | `/api/v1/design/projects/{id}/contracts` | List API contracts | APIX-004 |
| POST | `/api/v1/design/review` | **AI: design document review** | DES-004 |
| POST | `/api/v1/design/database-schema/generate` | **AI: generate DB schema** | DES-005 |

---

## AI Orchestration Service — Port 8005

| Method | Path | Description | SRS |
|---|---|---|---|
| GET  | `/api/v1/ai/jobs` | List AI jobs for project | — |
| GET  | `/api/v1/ai/jobs/{id}` | Get job status | APIX-003, UIX-003 |
| DELETE | `/api/v1/ai/jobs/{id}` | Cancel job | — |
| POST | `/api/v1/ai/apix/trigger` | **Trigger APIx backend generation** | APIX-001 |
| GET  | `/api/v1/ai/apix/jobs/{id}` | APIx job status + code reference | APIX-003 |
| GET  | `/api/v1/ai/apix/jobs/{id}/contract` | Get generated OpenAPI contract | APIX-004 |
| POST | `/api/v1/ai/uix/trigger` | **Trigger UIx frontend generation** | UIX-001 |
| GET  | `/api/v1/ai/uix/jobs/{id}` | UIx job status | UIX-003 |
| GET  | `/api/v1/ai/uix/jobs/{id}/preview` | **Get live preview URL** | UIX-005 |
| POST | `/api/v1/ai/integrationx/trigger` | **Trigger IntegrationX binding** | INTX-001 |
| GET  | `/api/v1/ai/integrationx/jobs/{id}` | IntegrationX status + mismatches | INTX-002 |
| POST | `/api/v1/ai/mobile/trigger` | **Trigger Mobile AI** | MOB-001 |
| GET  | `/api/v1/ai/mobile/jobs/{id}` | Mobile build status + versioning | MOB-002 |
| WS   | `/ws/jobs/{project_id}` | **Real-time job status stream** | APIX-003 |

---

## Test Management Service — Port 8006

| Method | Path | Description | SRS |
|---|---|---|---|
| GET  | `/api/v1/tests/cases` | List test cases | — |
| POST | `/api/v1/tests/generate` | **AI: generate test cases** | TST-001 |
| GET  | `/api/v1/tests/cases/{id}` | Get test case | — |
| GET  | `/api/v1/tests/runs` | List test runs | — |
| POST | `/api/v1/tests/execute` | **Execute test cases in parallel** | TST-002 |
| GET  | `/api/v1/tests/runs/{id}` | Test run results | TST-002 |
| GET  | `/api/v1/tests/coverage/{project_id}` | Code coverage report | TST-003 |
| POST | `/api/v1/tests/regression/select` | **AI: select regression tests** | TST-004 |
| GET  | `/api/v1/tests/performance/{project_id}` | Performance test results | TST-006 |
| GET  | `/api/v1/tests/defects` | List defects | — |

---

## DevOps / CI-CD Service — Port 8007

| Method | Path | Description | SRS |
|---|---|---|---|
| GET  | `/api/v1/pipelines` | List pipelines | — |
| POST | `/api/v1/pipelines` | **Create CI/CD pipeline (AI-suggested stages)** | DEP-001 |
| GET  | `/api/v1/pipelines/{id}` | Get pipeline | — |
| PUT  | `/api/v1/pipelines/{id}` | Update pipeline | — |
| POST | `/api/v1/pipelines/{id}/run` | Trigger pipeline run | — |
| POST | `/api/v1/pipelines/{id}/suggest` | AI-suggest stages | DEP-001 |
| GET  | `/api/v1/deployments` | List deployments | — |
| POST | `/api/v1/deployments` | **Trigger deployment** | DEP-002 |
| GET  | `/api/v1/deployments/{id}` | Get deployment status | — |
| POST | `/api/v1/deployments/{id}/rollback` | **Trigger rollback** | DEP-003 |
| GET  | `/api/v1/environments` | List environments | DEP-004 |
| POST | `/api/v1/environments` | Create environment | DEP-004 |
| GET  | `/api/v1/approvals` | List pending approvals | DEP-006 |
| POST | `/api/v1/approvals/{id}/approve` | Approve deployment gate | DEP-006 |
| POST | `/api/v1/approvals/{id}/reject` | Reject deployment gate | DEP-006 |
| GET  | `/api/v1/releases/{id}/notes` | **AI-generated release notes** | DEP-005 |

---

## MEE Service — Port 8008

| Method | Path | Description | SRS |
|---|---|---|---|
| GET  | `/api/v1/mee/activity-feed` | **Agent activity feed** | MEE-001 |
| GET  | `/api/v1/mee/activity-feed/stream` | SSE stream for live feed | MEE-001 |
| GET  | `/api/v1/mee/evidence/{project_id}` | **Evidence records** | MEE-002 |
| GET  | `/api/v1/mee/evidence/records/{id}` | Single evidence record | MEE-002 |
| GET  | `/api/v1/mee/metrics` | **Agent performance KPIs** | MEE-003 |
| GET  | `/api/v1/mee/anomalies` | **Detected anomalies** | MEE-004 |
| POST | `/api/v1/mee/anomalies/{id}/resolve` | Resolve anomaly | MEE-004 |
| POST | `/api/v1/mee/evidence/export` | **Export evidence report** | MEE-005 |
| GET  | `/api/v1/mee/evidence/export/{id}` | Export status + download URL | MEE-005 |
| GET  | `/api/v1/mee/comparison` | **Human vs AI productivity** | MEE-006 |
| POST | `/api/v1/mee/events` | Ingest MEE event (internal — AI engines only) | MEE-002 |

---

## Analytics Service — Port 8009

| Method | Path | Description | SRS |
|---|---|---|---|
| GET  | `/api/v1/analytics/dashboard/{project_id}` | Full dashboard summary | — |
| GET  | `/api/v1/analytics/velocity/{project_id}` | Sprint velocity history | — |
| GET  | `/api/v1/analytics/burndown/{sprint_id}` | Burndown chart data | — |
| GET  | `/api/v1/analytics/kpis/{project_id}` | Project KPIs | MEE-003 |
| GET  | `/api/v1/analytics/ai-productivity/{project_id}` | AI vs human productivity | MEE-006 |
| WS   | `/ws/analytics/{project_id}` | Real-time KPI updates | — |

---

## Notification Service — Port 8010

| Method | Path | Description | SRS |
|---|---|---|---|
| POST | `/api/v1/notifications/send` | Send notification (internal) | — |
| GET  | `/api/v1/notifications/preferences/{user_id}` | Get user notification preferences | — |
| PUT  | `/api/v1/notifications/preferences/{user_id}` | Update preferences | — |
| GET  | `/api/v1/notifications/history/{user_id}` | Notification history | — |

---

## Agent Developer Service — Port 8011

| Method | Path | Description | SRS |
|---|---|---|---|
| GET  | `/api/v1/agents` | **Agent registry** | AGT-003 |
| POST | `/api/v1/agents/design` | **Agent design studio** | AGT-001 |
| POST | `/api/v1/agents/generate` | **Generate agent from NL spec** | AGT-002 |
| GET  | `/api/v1/agents/{id}` | Get agent from registry | AGT-003 |
| PUT  | `/api/v1/agents/{id}` | Update agent design | AGT-001 |
| POST | `/api/v1/agents/{id}/deploy` | **Deploy agent** | AGT-004 |
| POST | `/api/v1/agents/{id}/test` | **Run agent test suites** | AGT-006 |
| GET  | `/api/v1/agents/{id}/versions` | Version history | AGT-005 |
| POST | `/api/v1/agents/{id}/rollback/{version}` | Rollback to version | AGT-005 |

---

## Legacy Conversion Service — Port 8012

| Method | Path | Description | SRS |
|---|---|---|---|
| POST | `/api/v1/legacy/ingest` | **Ingest legacy source files** | LCC-001 |
| POST | `/api/v1/legacy/convert` | **Start language conversion** | LCC-002 |
| GET  | `/api/v1/legacy/jobs/{id}` | Job progress + risk indicators | LCC-007 |
| GET  | `/api/v1/legacy/jobs/{id}/report` | **Detailed conversion report** | LCC-003 |
| POST | `/api/v1/legacy/validate` | **Validate converted code** | LCC-004 |
| POST | `/api/v1/legacy/tests/generate` | **Generate tests for converted code** | LCC-006 |

---

## Business Extraction Service — Port 8013

| Method | Path | Description | SRS |
|---|---|---|---|
| POST | `/api/v1/extraction/analyze` | **Analyze codebase for business logic** | BEX-001 |
| GET  | `/api/v1/extraction/jobs/{id}` | Extraction job status | — |
| GET  | `/api/v1/extraction/brd/{project_id}` | **Business Rules Document** | BEX-002 |
| GET  | `/api/v1/extraction/process-flows/{project_id}` | **Process flow diagrams** | BEX-003 |
| GET  | `/api/v1/extraction/wiki/{project_id}` | **Domain knowledge wiki** | BEX-004 |
| POST | `/api/v1/extraction/change-impact` | **Change impact analysis** | BEX-005 |
| GET  | `/api/v1/extraction/report/{project_id}` | Full stakeholder report | BEX-006 |
| GET  | `/api/v1/extraction/traceability/{project_id}` | Link rules to requirements | BEX-007 |

---

## Summary

| Service | REST Endpoints | WebSocket | Kafka (publish) | Kafka (consume) |
|---|---|---|---|---|
| Auth Service | 18 | — | — | — |
| Project Service | 16 | — | `requirements.changed` | — |
| Requirement Service | 9 | — | `requirements.changed` | — |
| Design Service | 7 | — | — | — |
| AI Orchestration | 13 | 1 | `ai.jobs.created`, `*.jobs` | `ai.jobs.completed`, `requirements.changed` |
| Test Management | 10 | — | — | `ai.jobs.completed` |
| DevOps Service | 16 | — | `deployments.*` | `ai.jobs.completed` |
| MEE Service | 11 | — | — | `mee.events` |
| Analytics Service | 5 | 1 | — | `ai.jobs.completed`, `deployments.*` |
| Notification Service | 4 | — | — | `notifications.send` |
| Agent Developer | 9 | — | `agent.jobs` | `ai.jobs.completed` |
| Legacy Conversion | 6 | — | `legacy.jobs` | `ai.jobs.completed` |
| Business Extraction | 8 | — | `bex.jobs` | `ai.jobs.completed` |
| **Total** | **132** | **2** | | |
