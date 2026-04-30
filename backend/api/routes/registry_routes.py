"""
api/routes/registry_routes.py
===============================
Agent Registry endpoints — the transparency dashboard for H4.

These endpoints surface the aggregated metrics that make process-level
failures visible to stakeholders. The registry is the mechanism H4
tests: does having these metrics available increase stakeholder trust?
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database.db import get_db
from database.models import AgentRun
from metrics.registry import compute_registry_summary

router = APIRouter()


@router.get("/registry/summary")
async def registry_summary(db: AsyncSession = Depends(get_db)):
    """
    Aggregated metrics across all runs.
    The gap_score is the key H1 number: process_error_rate - outcome_error_rate.
    A positive gap proves that traditional metrics underreport failures.
    """
    result = await db.execute(select(AgentRun))
    runs = [r.to_dict() for r in result.scalars().all()]
    return compute_registry_summary(runs)


@router.get("/registry/metrics-over-time")
async def metrics_over_time(db: AsyncSession = Depends(get_db)):
    """
    Time-series data for charting metric trends across all runs.
    Shows trajectory score, clause coverage, and outcome correctness over time.
    """
    result = await db.execute(
        select(AgentRun).order_by(AgentRun.started_at)
    )
    runs = result.scalars().all()

    return {
        "data": [
            {
                "timestamp": r.started_at.isoformat() if r.started_at else None,
                "run_id": r.run_id,
                "trajectory_score": r.trajectory_score,
                "clause_coverage_score": r.clause_coverage_score,
                "tool_call_accuracy_score": r.tool_call_accuracy_score,
                "outcome_correct": r.outcome_correct,
                "process_error_detected": r.process_error_detected,
                "autonomy_level": r.autonomy_level,
                "scenario_id": r.scenario_id,
                "final_verdict": r.final_verdict,
            }
            for r in runs
        ]
    }


@router.get("/registry/h1-evidence")
async def h1_evidence(db: AsyncSession = Depends(get_db)):
    """
    Runs where outcome_correct=True but process_error_detected=True.
    This is direct evidence for H1: the agent got the right answer
    through an incomplete process — invisible to outcome-only metrics.
    """
    result = await db.execute(
        select(AgentRun).where(
            AgentRun.outcome_correct == True,
            AgentRun.process_error_detected == True,
        ).order_by(desc(AgentRun.started_at))
    )
    h1_runs = result.scalars().all()

    total_result = await db.execute(select(AgentRun))
    total = len(total_result.scalars().all())

    return {
        "h1_run_count": len(h1_runs),
        "total_runs": total,
        "percentage": round(len(h1_runs) / total * 100, 1) if total > 0 else 0,
        "runs": [r.to_dict() for r in h1_runs],
        "interpretation": (
            f"{len(h1_runs)} out of {total} runs ({round(len(h1_runs)/total*100 if total else 0, 1)}%) "
            "returned a correct verdict while skipping required compliance steps. "
            "These errors are invisible to outcome-only evaluation but represent real process risk."
        ),
    }


@router.get("/registry/h2-evidence")
async def h2_evidence(db: AsyncSession = Depends(get_db)):
    """
    Aggregated error rates by autonomy level.
    Demonstrates H2: as autonomy increases, process errors increase
    even when outcome error rates remain similar.
    """
    evidence = {}
    for level in [1, 2, 3]:
        result = await db.execute(
            select(AgentRun).where(AgentRun.autonomy_level == level)
        )
        level_runs = result.scalars().all()
        if not level_runs:
            evidence[str(level)] = {"count": 0}
            continue

        total = len(level_runs)
        process_errors = sum(1 for r in level_runs if r.process_error_detected)
        outcome_errors = sum(1 for r in level_runs if r.outcome_correct == False)
        avg_coverage = sum(r.clause_coverage_score or 0 for r in level_runs) / total
        avg_trajectory = sum(r.trajectory_score or 0 for r in level_runs) / total

        evidence[str(level)] = {
            "count": total,
            "process_error_rate": round(process_errors / total, 4),
            "outcome_error_rate": round(outcome_errors / total, 4),
            "gap_score": round((process_errors - outcome_errors) / total, 4),
            "avg_clause_coverage": round(avg_coverage, 4),
            "avg_trajectory_score": round(avg_trajectory, 4),
            "autonomy_description": {
                1: "Constrained — explicit step-by-step instruction",
                2: "Moderate — hints provided, agent uses judgment",
                3: "High — minimal instruction, agent decides",
            }[level],
        }

    return {
        "by_autonomy_level": evidence,
        "interpretation": (
            "H2 is supported when process_error_rate increases across autonomy levels 1→2→3 "
            "while outcome_error_rate remains approximately constant."
        ),
    }
