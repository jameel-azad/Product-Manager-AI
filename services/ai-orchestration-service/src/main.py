from contextlib import asynccontextmanager
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.core.config import settings
from src.api.v1.router import router as api_router

log = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("ai-orchestration-service starting", port=settings.service_port)
    yield
    log.info("ai-orchestration-service shutting down")

app = FastAPI(
    title="ai-orchestration-service",
    description="AI engine job routing and orchestration hub",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "ai-orchestration-service", "version": "1.0.0"}
