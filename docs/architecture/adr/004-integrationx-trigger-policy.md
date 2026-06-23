# ADR-004: IntegrationX Trigger Timing and Timeout Policy

**Status**: Decided  
**Date**: June 2026  
**Deciders**: Product + Platform Architecture Team

---

## Context

SRS INTX-001 states: IntegrationX is triggered "after APIx AND UIx complete successfully". This raises three unresolved questions:

1. What is the timeout if one job takes significantly longer than the other?
2. What happens if one job fails — does IntegrationX trigger anyway with partial output?
3. Can a developer manually override and trigger IntegrationX before both complete?

## Decision

### Trigger Condition
IntegrationX triggers automatically **only when both APIx AND UIx jobs for the same `requirement_id` reach `completed` status**.

### Timeout Policy
- The AI Orchestration Service watches for a "both complete" condition per `(project_id, requirement_id)` pair.
- If one job completes and the other is still `running` or `queued`, the orchestrator waits up to **30 minutes**.
- After 30 minutes, if the second job has not completed, the orchestrator emits an `INTEGRATIONX_BLOCKED` event and sends a notification (INTX-002/INTX-003).
- The developer can then: (a) wait and retry, (b) manually trigger IntegrationX with only the available artifact, or (c) re-trigger the failed engine.

### Partial Integration (one job failed)
- If one job **fails** (not just slow), IntegrationX is **not** auto-triggered.
- A `MISMATCH_RISK` alert is sent (INTX-003) explaining that binding cannot proceed safely with incomplete artifacts.
- Manual override is available via `POST /ai/integrationx/trigger` with `allow_partial: true` — this requires explicit developer confirmation and is logged to MEE.

### Manual Override
- `POST /ai/integrationx/trigger` accepts `apix_job_id` and `uix_job_id` independently.
- If `allow_partial: true` is set, IntegrationX runs with whatever artifacts are available and clearly marks the binding as "partial" in its result.

## Consequences

- **Positive**: Prevents silent integration failures; developers are always notified of blocked states; MEE captures all partial integration decisions.
- **Negative**: 30-minute timeout may frustrate developers with fast APIx but slow UIx. Can be tuned per project in future.
- **Action required**: 
  - Implement `IntegrationXWatcher` in `ai-orchestration-service` that subscribes to `ai.jobs.completed` and maintains a pairing map in Redis.
  - Add `allow_partial` flag to `IntegrationXTriggerRequest` schema.
  - Notification Service must handle `INTEGRATIONX_BLOCKED` event type.
