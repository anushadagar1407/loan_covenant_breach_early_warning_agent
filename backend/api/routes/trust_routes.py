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


def _run_snapshot(run: AgentRun | None) -> dict | None:
    if run is None:
        return None
    return {
        "run_id": run.run_id,
        "scenario_id": run.scenario_id,
        "borrower_name": run.borrower_name,
        "autonomy_level": run.autonomy_level,
        "status": run.status,
        "final_verdict": run.final_verdict,
        "correct_verdict": run.correct_verdict,
        "outcome_correct": run.outcome_correct,
        "clause_coverage_score": run.clause_coverage_score,
        "process_error_detected": run.process_error_detected,
        "transparency_artifacts_present": run.transparency_artifacts_present,
        "execution_mode": run.execution_mode,
        "created_at": run.started_at.isoformat() if run.started_at else None,
    }


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
        response_source="human",
        trust_score=request.trust_score,
        auditability_score=request.auditability_score,
        reliability_score=request.reliability_score,
        explanation_sufficiency_score=request.explanation_sufficiency_score,
        comments=request.comments,
    )
    db.add(response)
    await db.commit()
    return response.to_dict()


@router.get("/responses")
async def list_trust_responses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TrustResponse).order_by(TrustResponse.created_at.desc())
    )
    responses = result.scalars().all()
    if not responses:
        return {"responses": []}

    run_ids = list({response.run_id for response in responses})
    run_result = await db.execute(select(AgentRun).where(AgentRun.run_id.in_(run_ids)))
    runs = {run.run_id: run for run in run_result.scalars().all()}

    return {
        "responses": [
            {
                **response.to_dict(),
                "run": _run_snapshot(runs.get(response.run_id)),
            }
            for response in responses
        ]
    }


@router.get("/analysis")
async def get_trust_analysis(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TrustResponse))
    responses = result.scalars().all()
    if not responses:
        return {
            "response_count": 0,
            "human_response_count": 0,
            "synthetic_response_count": 0,
            "evidence_source": "none",
            "h3_status": "not_evaluated",
            "h4_status": "not_evaluated",
            "stakeholder_group_count": 0,
            "paired_run_count": 0,
            "h3_readiness": {
                "regression_ready": False,
                "message": "Collect stakeholder trust responses before evaluating H3.",
            },
            "h4_readiness": {
                "comparison_ready": False,
                "message": "Collect outcome-only and transparent responses for the same run before evaluating H4.",
            },
            "message": "No stakeholder trust responses have been recorded yet.",
        }

    def _avg(items):
        return sum(items) / len(items) if items else None

    human_responses = [
        r for r in responses if (getattr(r, "response_source", None) or "human") == "human"
    ]
    synthetic_responses = [
        r for r in responses if (getattr(r, "response_source", None) or "human") == "synthetic_demo"
    ]
    evidence_source = (
        "human"
        if human_responses and not synthetic_responses
        else "synthetic_demo"
        if synthetic_responses and not human_responses
        else "mixed"
        if human_responses and synthetic_responses
        else "none"
    )

    def _condition_summary(condition: str):
        condition_responses = [r for r in responses if r.transparency_condition == condition]
        return {
            "count": len(condition_responses),
            "avg_trust_score": _avg([r.trust_score for r in condition_responses]),
            "avg_auditability_score": _avg([
                r.auditability_score for r in condition_responses if r.auditability_score is not None
            ]),
            "avg_reliability_score": _avg([
                r.reliability_score for r in condition_responses if r.reliability_score is not None
            ]),
            "avg_explanation_sufficiency_score": _avg([
                r.explanation_sufficiency_score
                for r in condition_responses
                if r.explanation_sufficiency_score is not None
            ]),
        }

    by_condition = {}
    for condition in ("outcome_only", "transparent"):
        by_condition[condition] = _condition_summary(condition)

    by_group = {}
    for group in sorted({r.stakeholder_group for r in responses}):
        group_responses = [r for r in responses if r.stakeholder_group == group]
        by_group[group] = {
            "count": len(group_responses),
            "avg_trust_score": _avg([r.trust_score for r in group_responses]),
            "avg_auditability_score": _avg([
                r.auditability_score for r in group_responses if r.auditability_score is not None
            ]),
            "avg_reliability_score": _avg([
                r.reliability_score for r in group_responses if r.reliability_score is not None
            ]),
            "avg_explanation_sufficiency_score": _avg([
                r.explanation_sufficiency_score
                for r in group_responses
                if r.explanation_sufficiency_score is not None
            ]),
        }

    outcome_avg = by_condition["outcome_only"]["avg_trust_score"]
    transparent_avg = by_condition["transparent"]["avg_trust_score"]
    trust_delta = (
        transparent_avg - outcome_avg
        if transparent_avg is not None and outcome_avg is not None
        else None
    )
    auditability_avg = _avg([r.auditability_score for r in responses if r.auditability_score is not None])
    reliability_avg = _avg([r.reliability_score for r in responses if r.reliability_score is not None])
    explanation_avg = _avg([
        r.explanation_sufficiency_score
        for r in responses
        if r.explanation_sufficiency_score is not None
    ])

    run_conditions = {}
    for response in responses:
        run_conditions.setdefault(response.run_id, set()).add(response.transparency_condition)
    paired_run_count = sum(
        1
        for conditions in run_conditions.values()
        if {"outcome_only", "transparent"}.issubset(conditions)
    )
    stakeholder_group_count = len(by_group)
    balanced_conditions = (
        by_condition["outcome_only"]["count"] > 0
        and by_condition["transparent"]["count"] > 0
    )
    h3_regression_ready = len(responses) >= 10 and stakeholder_group_count >= 2
    h4_comparison_ready = paired_run_count > 0 or balanced_conditions

    h3_message = (
        "Enough pilot responses exist to start comparing traditional metrics with transparency-based trust predictors."
        if h3_regression_ready
        else "Collect at least 10 responses across two or more stakeholder groups for a credible H3 pilot comparison."
    )
    h4_message = (
        "Outcome-only and transparent conditions are available for a transparency-trust comparison."
        if h4_comparison_ready
        else "Collect both outcome-only and transparent responses for the same run to isolate the transparency effect."
    )

    return {
        "response_count": len(responses),
        "human_response_count": len(human_responses),
        "synthetic_response_count": len(synthetic_responses),
        "evidence_source": evidence_source,
        "by_condition": by_condition,
        "by_stakeholder_group": by_group,
        "transparency_trust_delta": trust_delta,
        "stakeholder_group_count": stakeholder_group_count,
        "paired_run_count": paired_run_count,
        "trust_predictor_averages": {
            "auditability_score": auditability_avg,
            "reliability_score": reliability_avg,
            "explanation_sufficiency_score": explanation_avg,
        },
        "h3_readiness": {
            "regression_ready": h3_regression_ready,
            "message": h3_message,
        },
        "h4_readiness": {
            "comparison_ready": h4_comparison_ready,
            "message": h4_message,
        },
        "h3_status": "pilot_ready" if h3_regression_ready else "data_collection_started",
        "h4_status": (
            "supported_directionally"
            if trust_delta is not None and trust_delta > 0
            else "comparison_ready" if h4_comparison_ready
            else "data_collection_started"
        ),
        "note": "Treat H3/H4 as pilot evidence until the stakeholder sample is balanced and large enough for final thesis analysis.",
    }
