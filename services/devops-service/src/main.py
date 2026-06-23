from contextlib import asynccontextmanager
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.core.config import settings
from src.api.v1.router import router as api_router

log = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("devops-service starting", port=settings.service_port)
    yield
    log.info("devops-service shutting down")

app = FastAPI(
    title="devops-service",
    description="CI/CD pipelines, deployments, rollback, approvals",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "devops-service", "version": "1.0.0"}
