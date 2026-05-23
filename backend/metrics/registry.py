"""UPDATED registry with statistical validation"""
import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database.models import AgentRun
from metrics.statistical_analysis import (
    validate_h1_gap_score,
    validate_h2_autonomy_errors,
    compute_classification_metrics,
    compare_approaches
)

def _to_py(obj):
    """Recursively convert numpy scalars (np.generic, np.bool_) to native Python types."""
    if isinstance(obj, np.generic):
        return obj.item()
    if isinstance(obj, dict):
        return {k: _to_py(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_py(v) for v in obj]
    return obj

async def get_registry_summary(session: AsyncSession) -> dict:
    """Get comprehensive registry summary with statistical validation."""
    result = await session.execute(select(AgentRun))
    runs = result.scalars().all()

    if len(runs) == 0:
        return {"total_runs": 0, "message": "No runs found"}

    total_runs = len(runs)

    # Normalize coverage and trajectory to avoid None-type math
    coverages = [(r.clause_coverage_score or 0.0) for r in runs]
    trajectories = [(r.trajectory_score or 0.0) for r in runs]

    process_errors = sum(1 for r in runs if r.process_error_detected)
    outcome_errors = sum(1 for r in runs if not r.outcome_correct)
    fully_compliant = sum(1 for c in coverages if c >= 1.0)

    process_error_rate = process_errors / total_runs
    outcome_error_rate = outcome_errors / total_runs
    gap_score = process_error_rate - outcome_error_rate
    avg_coverage = sum(coverages) / total_runs
    avg_trajectory = sum(trajectories) / total_runs
    compliance_rate = fully_compliant / total_runs
    h1_evidence_count = sum(1 for r in runs if r.outcome_correct and r.process_error_detected)

    h1_validation = _to_py(validate_h1_gap_score(runs))
    h2_validation = _to_py(validate_h2_autonomy_errors(runs))
    classification_metrics = _to_py(compute_classification_metrics(runs))

    level_stats = {}
    for level in [1, 2, 3]:
        level_runs = [r for r in runs if r.autonomy_level == level]
        if len(level_runs) > 0:
            lvl_coverages = [(r.clause_coverage_score or 0.0) for r in level_runs]
            level_stats[f"level_{level}"] = {
                "count": len(level_runs),
                "process_error_rate": (
                    sum(1 for r in level_runs if r.process_error_detected) / len(level_runs)
                ),
                "avg_coverage": sum(lvl_coverages) / len(level_runs),
                "outcome_accuracy": (
                    sum(1 for r in level_runs if r.outcome_correct) / len(level_runs)
                ),
            }

    return {
        "total_runs": total_runs,
        "gap_score": gap_score,
        "process_error_rate": process_error_rate,
        "outcome_error_rate": outcome_error_rate,
        "process_errors": process_errors,
        "outcome_errors": outcome_errors,
        "fully_compliant_runs": fully_compliant,
        "compliance_rate": compliance_rate,
        "avg_clause_coverage_score": avg_coverage,
        "avg_trajectory_score": avg_trajectory,
        "h1_validation": h1_validation,
        "h2_validation": h2_validation,
        "classification_metrics": classification_metrics,
        "level_stats": level_stats,
        "runs_by_autonomy_level": level_stats,
        "h1_evidence": {"count": h1_evidence_count},
    }

async def get_h1_evidence(session: AsyncSession) -> dict:
    """
    H1 Evidence: runs where the final outcome is correct
    BUT the agent had process errors (skipped tools, etc.).
    """
    result = await session.execute(
        select(AgentRun).where(
            AgentRun.outcome_correct == True,          # noqa: E712
            AgentRun.process_error_detected == True,   # noqa: E712
        )
    )
    runs = result.scalars().all()

    evidence_runs = [
        {
            "run_id": r.run_id,
            "scenario_id": r.scenario_id,
            "borrower_id": r.borrower_id,
            "borrower_name": r.borrower_name,
            "autonomy_level": r.autonomy_level,
            "clause_coverage_score": r.clause_coverage_score,
            "final_verdict": r.final_verdict,
        }
        for r in runs
    ]

    return {
        "h1_run_count": len(runs),
        "interpretation": "Runs with correct outcomes but non-compliant process steps.",
        "runs": evidence_runs,
    }
    
async def get_h2_evidence(session: AsyncSession) -> dict:
    """
    H2 Evidence: process error rates by autonomy level.
    """
    evidence = {}

    for level in [1, 2, 3]:
        result = await session.execute(
            select(AgentRun).where(AgentRun.autonomy_level == level)
        )
        level_runs = result.scalars().all()
        if not level_runs:
            continue

        total = len(level_runs)
        process_errors = sum(1 for r in level_runs if r.process_error_detected)
        avg_coverage = sum((r.clause_coverage_score or 0.0) for r in level_runs) / total
        outcome_errors = sum(1 for r in level_runs if not r.outcome_correct)

        evidence[str(level)] = {
            "count": total,
            "process_error_rate": process_errors / total,
            "avg_clause_coverage": avg_coverage,
            "outcome_error_rate": outcome_errors / total,
            "gap_score": (process_errors / total) - (outcome_errors / total),
        }

    return {
        "interpretation": "Higher autonomy is associated with more process errors and lower clause coverage.",
        "by_autonomy_level": evidence,
    }


async def get_baseline_comparison(session: AsyncSession, baseline_type: str) -> dict:
    """
    Baseline comparison placeholder.

    Looks for baseline runs stored with special autonomy levels:
    - 0  => rule-based baseline
    - -1 => single-shot LLM baseline
    """
    # Agent runs: real autonomy levels 1–3
    agent_result = await session.execute(
        select(AgentRun).where(AgentRun.autonomy_level.in_([1, 2, 3]))
    )
    agent_runs = agent_result.scalars().all()

    if baseline_type == "rule_based":
        baseline_level = 0
    elif baseline_type == "single_shot_llm":
        baseline_level = -1
    else:
        return {"error": f"Unknown baseline_type '{baseline_type}'"}

    baseline_result = await session.execute(
        select(AgentRun).where(AgentRun.autonomy_level == baseline_level)
    )
    baseline_runs = baseline_result.scalars().all()

    if not baseline_runs:
        return {
            "error": f"No {baseline_type} baseline runs found in database",
            "recommendation": f"Run: python scripts/run_baselines.py --type {baseline_type}",
        }

    def accuracy(runs):
        if not runs:
            return 0.0
        return sum(1 for r in runs if r.outcome_correct) / len(runs)

    def avg_coverage(runs):
        if not runs:
            return 0.0
        return sum((r.clause_coverage_score or 0.0) for r in runs) / len(runs)

    return {
        "comparison": f"Agent vs {baseline_type}",
        "agent_accuracy_mean": accuracy(agent_runs),
        "baseline_accuracy_mean": accuracy(baseline_runs),
        "agent_coverage_mean": avg_coverage(agent_runs),
        "baseline_coverage_mean": avg_coverage(baseline_runs),
    }
