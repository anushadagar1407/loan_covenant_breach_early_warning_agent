"""UPDATED API routes with statistical endpoints"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from database.session import get_db
from metrics.registry import get_registry_summary

router = APIRouter(prefix="/registry", tags=["Registry"])

@router.get("/summary")
async def get_summary(session: AsyncSession = Depends(get_db)):
    """Get comprehensive registry summary with statistical validation."""
    summary = await get_registry_summary(session)
    return summary

@router.get("/h1-validation")
async def get_h1_validation(session: AsyncSession = Depends(get_db)):
    """Get detailed H1 validation results."""
    summary = await get_registry_summary(session)
    return {"hypothesis": "H1: Outcome metrics mask process risk", "validation": summary.get("h1_validation", {})}

@router.get("/h2-validation")
async def get_h2_validation(session: AsyncSession = Depends(get_db)):
    """Get detailed H2 validation results."""
    summary = await get_registry_summary(session)
    return {"hypothesis": "H2: Autonomy increases process errors", "validation": summary.get("h2_validation", {})}

@router.get("/classification-metrics")
async def get_classification_metrics(session: AsyncSession = Depends(get_db)):
    """Get classification metrics (P/R/F1)."""
    summary = await get_registry_summary(session)
    return {"classification_metrics": summary.get("classification_metrics", {})}
