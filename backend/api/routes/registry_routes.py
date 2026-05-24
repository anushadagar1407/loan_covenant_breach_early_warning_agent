"""UPDATED API routes with statistical endpoints"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from database.db import get_db 
from metrics.registry import (
    get_registry_summary,
    get_h1_evidence,
    get_h2_evidence,
    get_baseline_comparison,
    get_metrics_over_time,
)

router = APIRouter(prefix="/registry", tags=["Registry"])

@router.get("/summary")
async def get_summary(session: AsyncSession = Depends(get_db)):
    """Get comprehensive registry summary with statistical validation."""
    summary = await get_registry_summary(session)
    return summary

@router.get("/h1-evidence")
async def get_h1_evidence_route(session: AsyncSession = Depends(get_db)):
    """Get H1 evidence in the shape the frontend expects."""
    return await get_h1_evidence(session)

@router.get("/h2-evidence")
async def get_h2_evidence_route(session: AsyncSession = Depends(get_db)):
    """Get H2 evidence in the shape the frontend expects."""
    return await get_h2_evidence(session)

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

@router.get("/metrics-over-time")
async def get_metrics_over_time_route(session: AsyncSession = Depends(get_db)):
    """Get run-level metric history for trend analysis."""
    return await get_metrics_over_time(session)

@router.get("/h3-validation")
async def get_h3_validation(session: AsyncSession = Depends(get_db)):
    """Report H3 readiness from available trust-study data."""
    summary = await get_summary(session)
    return {"hypothesis": "H3: Traditional metrics do not explain trust", "validation": summary.get("h3_validation", {})}

@router.get("/h4-validation")
async def get_h4_validation(session: AsyncSession = Depends(get_db)):
    """Report H4 readiness from available transparency-condition data."""
    summary = await get_summary(session)
    return {"hypothesis": "H4: Transparency drives trust", "validation": summary.get("h4_validation", {})}

@router.get("/baselines/compare")
async def compare_baselines(
    baseline_type: str = Query("rule_based"),
    session: AsyncSession = Depends(get_db),
):
    """Compare agent runs against a baseline cohort."""
    return await get_baseline_comparison(session, baseline_type)
