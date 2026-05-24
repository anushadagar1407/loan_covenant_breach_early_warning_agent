"""
api/main.py
============
FastAPI application entry point.
"""

import os
from dotenv import load_dotenv
load_dotenv()
import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database.db import init_db
from api.routes.agent_routes import router as agent_router
from api.routes.registry_routes import router as registry_router
from api.routes.trust_routes import router as trust_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(
    title="Covenant Breach Agent API",
    description="Loan Covenant Breach Early Warning — Deutsche Bank Thesis Project",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent_router, prefix="/api")
app.include_router(registry_router, prefix="/api")
app.include_router(trust_router, prefix="/api")

@app.get("/health")
async def health():
    """Check API, Ollama, and database connectivity."""
    ollama_ok = False
    db_ok = False

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(
                f"{os.getenv('OLLAMA_HOST', 'http://localhost:11434')}/api/tags"
            )
            ollama_ok = r.status_code == 200
    except Exception:
        pass

    try:
        from database.db import engine
        async with engine.connect() as conn:
            await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    return {
        "status": "ok",
        "ollama_connected": ollama_ok,
        "db_connected": db_ok,
    }
