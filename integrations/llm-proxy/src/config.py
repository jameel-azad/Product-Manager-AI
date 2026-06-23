"""
LLM Proxy — LiteLLM-based unified router for all AI engine LLM calls.
All AI engines call this proxy instead of provider APIs directly.
Credentials are loaded from Vault, not hardcoded.
"""

from pydantic_settings import BaseSettings


class LLMProxyConfig(BaseSettings):
    port: int = 4000
    master_key: str = "change-me"

    # Provider API keys (populated from Vault)
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # Redis for rate limiting and caching
    redis_url: str = "redis://localhost:6379/1"

    class Config:
        env_file = ".env"


# Model routing table — which LLM each engine uses
MODEL_ROUTING = {
    "apix": {
        "primary": "anthropic/claude-opus-4-8",
        "fallback": "openai/gpt-4o",
        "max_tokens": 8192,
        "temperature": 0.1,
    },
    "uix": {
        "primary": "anthropic/claude-sonnet-4-6",
        "fallback": "openai/gpt-4o",
        "max_tokens": 4096,
        "temperature": 0.2,
    },
    "integrationx": {
        "primary": "anthropic/claude-sonnet-4-6",
        "fallback": "openai/gpt-4-turbo",
        "max_tokens": 2048,
        "temperature": 0.0,
    },
    "ai_planning": {
        "primary": "anthropic/claude-haiku-4-5-20251001",
        "fallback": "openai/gpt-3.5-turbo",
        "max_tokens": 2048,
        "temperature": 0.3,
    },
    "business_extractor": {
        "primary": "anthropic/claude-opus-4-8",
        "fallback": "openai/gpt-4o",
        "max_tokens": 8192,
        "temperature": 0.1,
    },
    "design_review": {
        "primary": "anthropic/claude-sonnet-4-6",
        "fallback": "openai/gpt-4o",
        "max_tokens": 4096,
        "temperature": 0.2,
    },
}

config = LLMProxyConfig()
