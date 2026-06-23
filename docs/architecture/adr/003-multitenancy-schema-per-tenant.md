# ADR-003: Multi-Tenancy DB Isolation — Schema-per-Tenant

**Status**: Decided  
**Date**: June 2026  
**Deciders**: Platform Architecture Team

---

## Context

The platform must support SaaS (multi-tenant) and on-premise deployment. For SaaS, tenant data isolation is required. Three approaches were considered:

1. **Schema-per-tenant** (one PostgreSQL schema per org): `org_abc.projects`, `org_xyz.projects`
2. **Row-level security** (RLS): Single schema, `tenant_id` column, RLS policies enforced by Postgres
3. **Database-per-tenant**: Fully isolated Postgres instance per org

## Decision

**Schema-per-tenant** for the initial SaaS offering, with Database-per-tenant available for regulated enterprise customers on request.

## Rationale

| Factor | Schema-per-tenant | RLS | DB-per-tenant |
|---|---|---|---|
| Isolation strength | ✅ Strong — separate namespaces | ⚠ Medium — policy bugs leak data | ✅ Maximum |
| Scalability | ✅ Good up to ~500 tenants | ✅ Scales to thousands | ❌ Cost-prohibitive at scale |
| Migration complexity | ⚠ Run per-schema | ✅ Single migration | ❌ Run per-database |
| Compliance (regulated) | ✅ Sufficient for most | ⚠ May fail audits | ✅ Preferred |
| Operational complexity | Medium | Low | High |

**Why not RLS?** RLS is the most scalable option but has a higher risk of data leakage if a policy is written incorrectly. Given the platform handles sensitive code artifacts and compliance evidence, schema isolation is the safer default. RLS bugs that cross tenant boundaries would be a critical security incident.

**Why not DB-per-tenant?** Cost. At 100 customers, maintaining 100 RDS instances is operationally and financially prohibitive for a startup-stage product.

## Consequences

- **Positive**: Strong isolation by default; each tenant can be backed up and restored independently; simpler to reason about security boundaries.
- **Negative**: Alembic migrations must run across all schemas — tooling required. Postgres schema limit (~10,000) is not a concern at our projected scale.
- **Action required**: 
  - Implement tenant schema provisioning in `auth-service` org creation flow
  - Build migration runner that applies `data/postgres/migrations/` to all schemas
  - `tenant_id` column remains on all tables for cross-schema queries (analytics, global admin)
