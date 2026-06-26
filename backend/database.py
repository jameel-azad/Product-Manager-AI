"""
Xccelera AI-SDLC Platform — async SQLAlchemy database setup.

Supports two backends (selected via the DATABASE_URL env var):
  - SQLite + aiosqlite  (local development, the default)
  - PostgreSQL + asyncpg (production / Cloud SQL on GCP)
"""

import os
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base
from sqlalchemy import event

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./xccelera_demo.db",
)

_is_sqlite = "sqlite" in DATABASE_URL

engine = create_async_engine(
    DATABASE_URL,
    echo=bool(os.getenv("DB_ECHO", "")),
    future=True,
    # SQLite needs check_same_thread=False; PostgreSQL ignores connect_args
    connect_args={"check_same_thread": False} if _is_sqlite else {},
)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

# ---------------------------------------------------------------------------
# Declarative base
# ---------------------------------------------------------------------------

Base = declarative_base()

# ---------------------------------------------------------------------------
# Dependency — FastAPI route injection
# ---------------------------------------------------------------------------


async def get_db() -> AsyncSession:  # type: ignore[return]
    """
    FastAPI dependency that yields an AsyncSession and guarantees cleanup.

    Usage in a route::

        @router.get("/items")
        async def list_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ---------------------------------------------------------------------------
# Database initialisation helper
# ---------------------------------------------------------------------------


async def init_db() -> None:
    """
    Create all tables defined in Base.metadata if they do not already exist.
    Call once at application startup (e.g. inside a lifespan context manager).

    For SQLite, also enables WAL journal mode for better concurrent access.
    PostgreSQL requires no special pragmas.
    """
    # Import all models so their metadata is registered before create_all
    from models import (  # noqa: F401 — side-effect import
        Organization,
        User,
        Project,
        Requirement,
        BacklogItem,
        Sprint,
        AIJob,
        TestCase,
        TestRun,
        Deployment,
        Pipeline,
        PipelineRun,
        MEEEvent,
        AgentRecord,
        LegacyJob,
        ExtractionJob,
        DesignArtifact,
        RefreshToken,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Enable WAL mode on SQLite for concurrent read/write
    if _is_sqlite:
        async with engine.connect() as conn:
            await conn.exec_driver_sql("PRAGMA journal_mode=WAL")
            await conn.exec_driver_sql("PRAGMA foreign_keys=ON")

