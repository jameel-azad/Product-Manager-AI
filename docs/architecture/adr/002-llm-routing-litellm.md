# ADR-002: LLM Routing Strategy — LiteLLM Proxy

**Status**: Decided  
**Date**: June 2026  
**Deciders**: Platform Architecture Team

---

## Context

The platform uses LLMs to power: APIx backend generation, UIx frontend generation, IntegrationX contract analysis, the AI Planning Engine (NLP), Business Extraction, and the Design Review assistant. SRS §5.9 lists OpenAI, Anthropic, and custom LLMs as supported providers. A unified routing layer is needed for:
- Unified auth (single API key surface rather than per-service credentials)
- Cost tracking per engine/project
- Rate limiting and quota management
- Fallback routing (e.g., if Anthropic is degraded, fall back to OpenAI)
- Model selection per engine (different models may suit different tasks)

## Decision

**Deploy LiteLLM as a self-hosted proxy** in the `integrations/llm-proxy` service.

All AI engines call `LLM_PROXY_URL` with a standard OpenAI-compatible API. LiteLLM translates to the target provider.

## Model Assignment

| Engine | Primary Model | Fallback |
|---|---|---|
| APIx (code generation) | `claude-opus-4-8` | `gpt-4o` |
| UIx (frontend generation) | `claude-sonnet-4-6` | `gpt-4o` |
| IntegrationX (contract analysis) | `claude-sonnet-4-6` | `gpt-4-turbo` |
| AI Planning Engine (NLP) | `claude-haiku-4-5` | `gpt-3.5-turbo` |
| Business Extraction | `claude-opus-4-8` | `gpt-4o` |
| Design Review | `claude-sonnet-4-6` | `gpt-4o` |

## Rationale

- **LiteLLM**: Open-source, battle-tested, OpenAI-compatible endpoint, supports 100+ models, has built-in cost tracking and Redis-backed rate limiting. Building a custom proxy is not justified.
- **Anthropic Claude primary**: Strongest code generation and analysis performance for Xccelera's use cases; aligns with Xccelera's existing Anthropic relationship.
- **Provider credentials**: Stored in HashiCorp Vault, injected into the LiteLLM proxy at startup. No AI engine holds provider keys.

## Consequences

- **Positive**: Single audit point for all LLM spend; easy model swaps without touching AI engine code; fallback routing improves resilience.
- **Negative**: LiteLLM proxy is a new SPOF — mitigated by running 3 replicas behind a load balancer in the `ai` namespace.
- **Action required**: Configure `integrations/llm-proxy` with model routing table. Set per-engine cost budgets in LiteLLM config.
