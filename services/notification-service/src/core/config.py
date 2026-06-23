from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    service_port: int = 8010
    service_name: str = "notification-service"
    environment: str = "development"
    allowed_origins: list[str] = ["http://localhost:3000"]
    database_url: str = "postgresql+asyncpg://xccelera:changeme@localhost:5432/xccelera"
    redis_url: str = "redis://localhost:6379/0"
    kafka_bootstrap_servers: str = "localhost:9092"
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    xccelera_internal_service_token: str = "change-me"

    class Config:
        env_file = ".env"

settings = Settings()
