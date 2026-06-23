# ADR-001: Event Bus — Kafka over RabbitMQ

**Status**: Decided  
**Date**: June 2026  
**Deciders**: Platform Architecture Team

---

## Context

The SRS (§5.9) mentions both Kafka and RabbitMQ as candidates for the shared event bus connecting all platform microservices. A decision is required before infrastructure provisioning begins.

The event bus must handle:
- AI job lifecycle events (created, completed, failed) routed to correct engine queues
- `RequirementChanged` events triggering optional re-generation in APIx/UIx
- MEE events (before/after every AI action) requiring durable, replayable storage for compliance
- Notification events distributed to Slack/Teams/email consumers
- Real-time status streaming to the dashboard WebSocket

## Decision

**Use Apache Kafka** (AWS MSK in cloud, Confluent Platform on-prem).

## Rationale

| Factor | Kafka | RabbitMQ |
|---|---|---|
| Throughput (10K concurrent users) | ✅ Millions/sec | ⚠ Tens of thousands/sec |
| Event replay | ✅ Configurable retention (MEE: 1 year) | ❌ Messages deleted after consume |
| MEE compliance (immutable audit trail) | ✅ Append-only log, compaction disabled on `mee.events` | ❌ Not designed for audit logs |
| Fan-out (multiple consumers per event) | ✅ Consumer groups, each gets own offset | ✅ Exchanges support this |
| Operational maturity | ✅ AWS MSK managed | ✅ Good tooling |
| Schema evolution | ✅ Schema Registry (Confluent) | ⚠ Requires manual management |
| KEDA scaling | ✅ Native Kafka lag metric | ⚠ Requires plugin |

MEE's requirement for event replay — re-processing evidence records after a system failure — is the decisive factor. RabbitMQ deletes messages once consumed; Kafka retains them for the configured window.

## Consequences

- **Positive**: Compliance-ready audit trail, ability to replay and reprocess MEE events, natural fit for KEDA-based horizontal scaling of AI engine consumers.
- **Negative**: Higher operational complexity than RabbitMQ; Kafka is overkill if AI job volume stays low. Mitigated by using AWS MSK (managed).
- **Action required**: Define retention policies per topic (see `data/kafka/topics.yaml`). `mee.events` retention is 1 year hot; cold archival to S3 Glacier handles the 7-year compliance window.
