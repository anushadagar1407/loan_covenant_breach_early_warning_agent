"""
database/db.py
===============
SQLAlchemy async engine setup and session management.
Uses aiosqlite driver for async SQLite access.
"""

import os
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from database.models import Base

DB_PATH = Path(__file__).parent.parent / "data" / "covenant_agent.db"
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite+aiosqlite:///{DB_PATH}"
)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db():
    """Create all tables if they don't exist."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _ensure_agent_run_columns(conn)
        await _ensure_trust_response_columns(conn)
    print(f"Database initialized at {DB_PATH}")


async def _ensure_agent_run_columns(conn):
    """SQLite-friendly migration for research metadata columns."""
    result = await conn.execute(text("PRAGMA table_info(agent_runs)"))
    existing = {row[1] for row in result.fetchall()}
    columns = {
        "data_source": "VARCHAR(50)",
        "ground_truth_fallback_used": "BOOLEAN DEFAULT 0",
        "experiment_condition": "VARCHAR(50) DEFAULT 'standard'",
        "transparency_artifacts_present": "BOOLEAN DEFAULT 0",
    }
    for name, ddl in columns.items():
        if name not in existing:
            await conn.execute(text(f"ALTER TABLE agent_runs ADD COLUMN {name} {ddl}"))


async def _ensure_trust_response_columns(conn):
    """SQLite-friendly migration for trust-study provenance columns."""
    result = await conn.execute(text("PRAGMA table_info(trust_responses)"))
    existing = {row[1] for row in result.fetchall()}
    columns = {
        "response_source": "VARCHAR(50) DEFAULT 'human'",
    }
    for name, ddl in columns.items():
        if name not in existing:
            await conn.execute(text(f"ALTER TABLE trust_responses ADD COLUMN {name} {ddl}"))


async def get_db():
    """FastAPI dependency for database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(init_db())
