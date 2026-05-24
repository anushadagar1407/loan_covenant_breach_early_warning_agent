"""
api/routes/trust_routes.py
==========================
Endpoints for the stakeholder trust-study layer used by H3/H4.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.db import get_db
from database.models import AgentRun, TrustResponse

router = APIRouter(prefix="/trust", tags=["Trust Study"])


class TrustResponseRequest(BaseModel):
    run_id: str
    stakeholder_group: str = Field(pattern="^(technical|non_technical|risk_compliance|business)$")
    transparency_condition: str = Field(pattern="^(outcome_only|transparent)$")
    trust_score: float = Field(ge=1, le=7)
    auditability_score: Optional[float] = Field(default=None, ge=1, le=7)
    reliability_score: Optional[float] = Field(default=None, ge=1, le=7)
    explanation_sufficiency_score: Optional[float] = Field(default=None, ge=1, le=7)
    comments: Optional[str] = None


@router.post("/responses")
async def create_trust_response(
    request: TrustResponseRequest,
    db: AsyncSession = Depends(get_db),
):
    run_result = await db.execute(select(AgentRun).where(AgentRun.run_id == request.run_id))
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {request.run_id} not found")

    response = TrustResponse(
        response_id=str(uuid.uuid4()),
        run_id=request.run_id,
        stakeholder_group=request.stakeholder_group,
        transparency_condition=request.transparency_condition,
        trust_score=request.trust_score,
        auditability_score=request.auditability_score,
        reliability_score=request.reliability_score,
        explanation_sufficiency_score=request.explanation_sufficiency_score,
        comments=request.comments,
    )
    db.add(response)
    await db.commit()
    return response.to_dict()


@router.get("/analysis")
async def get_trust_analysis(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TrustResponse))
    responses = result.scalars().all()
    if not responses:
        return {
            "response_count": 0,
            "h3_status": "not_evaluated",
            "h4_status": "not_evaluated",
            "message": "No stakeholder trust responses have been recorded yet.",
        }

    def _avg(items):
        return sum(items) / len(items) if items else None

    by_condition = {}
    for condition in ("outcome_only", "transparent"):
        subset = [r.trust_score for r in responses if r.transparency_condition == condition]
        by_condition[condition] = {
            "count": len(subset),
            "avg_trust_score": _avg(subset),
        }

    by_group = {}
    for group in sorted({r.stakeholder_group for r in responses}):
        subset = [r.trust_score for r in responses if r.stakeholder_group == group]
        by_group[group] = {
            "count": len(subset),
            "avg_trust_score": _avg(subset),
        }

    outcome_avg = by_condition["outcome_only"]["avg_trust_score"]
    transparent_avg = by_condition["transparent"]["avg_trust_score"]
    trust_delta = (
        transparent_avg - outcome_avg
        if transparent_avg is not None and outcome_avg is not None
        else None
    )

    return {
        "response_count": len(responses),
        "by_condition": by_condition,
        "by_stakeholder_group": by_group,
        "transparency_trust_delta": trust_delta,
        "h3_status": "data_collection_started",
        "h4_status": "supported_directionally" if trust_delta and trust_delta > 0 else "data_collection_started",
        "note": "Use this as pilot evidence until enough balanced stakeholder responses exist for regression analysis.",
    }
