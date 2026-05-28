"""Registry aggregation with statistical validation for thesis evidence."""
import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database.models import AgentRun, TrustResponse
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
    all_runs = result.scalars().all()
    runs = [
        r for r in all_runs
        if r.status == "completed" and r.outcome_correct is not None
    ]

    if len(runs) == 0:
        return await _empty_registry_summary(session, len(all_runs))

    total_runs = len(all_runs)
    evaluated_runs = len(runs)

    # Normalize coverage and trajectory to avoid None-type math
    coverages = [(r.clause_coverage_score or 0.0) for r in runs]
    trajectories = [(r.trajectory_score or 0.0) for r in runs]

    process_errors = sum(1 for r in runs if r.process_error_detected)
    outcome_errors = sum(1 for r in runs if not r.outcome_correct)
    fully_compliant = sum(1 for c in coverages if c >= 1.0)

    process_error_rate = process_errors / evaluated_runs
    outcome_error_rate = outcome_errors / evaluated_runs
    gap_score = process_error_rate - outcome_error_rate
    avg_coverage = sum(coverages) / evaluated_runs
    avg_trajectory = sum(trajectories) / evaluated_runs
    compliance_rate = fully_compliant / evaluated_runs
    h1_evidence_count = sum(1 for r in runs if r.outcome_correct and r.process_error_detected)
    fallback_count = sum(1 for r in runs if getattr(r, "ground_truth_fallback_used", False))
    transparent_count = sum(1 for r in runs if getattr(r, "transparency_artifacts_present", False))
    adk_attempts = sum(1 for r in runs if getattr(r, "adk_invocation_attempted", False))
    fallback_runs = sum(1 for r in runs if getattr(r, "deterministic_fallback_used", False))

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
                "avg_clause_coverage": sum(lvl_coverages) / len(level_runs),
                "avg_coverage": sum(lvl_coverages) / len(level_runs),
                "outcome_accuracy": (
                    sum(1 for r in level_runs if r.outcome_correct) / len(level_runs)
                ),
                "outcome_error_rate": (
                    sum(1 for r in level_runs if r.outcome_correct is False) / len(level_runs)
                ),
            }
            level_stats[str(level)] = level_stats[f"level_{level}"]

    trust_status = await _trust_status(session)

    return {
        "total_runs": total_runs,
        "evaluated_runs": evaluated_runs,
        "running_or_incomplete_runs": total_runs - evaluated_runs,
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
        "evidence_quality": {
            "minimum_runs_met": evaluated_runs >= 30,
            "ground_truth_fallback_runs": fallback_count,
            "ground_truth_fallback_rate": fallback_count / evaluated_runs,
            "transparency_artifact_rate": transparent_count / evaluated_runs,
            "adk_invocation_attempted_runs": adk_attempts,
            "adk_invocation_rate": adk_attempts / evaluated_runs,
            "deterministic_fallback_runs": fallback_runs,
            "note": (
                "Treat hypothesis labels as exploratory until evaluation cohorts "
                "exclude synthetic fallback rows and meet the planned sample size."
            ),
        },
        "h3_validation": trust_status["h3_validation"],
        "h4_validation": trust_status["h4_validation"],
    }


async def _empty_registry_summary(session: AsyncSession, total_runs: int) -> dict:
    trust_status = await _trust_status(session)
    h1_validation = _to_py(validate_h1_gap_score([]))
    h2_validation = _to_py(validate_h2_autonomy_errors([]))
    classification_metrics = _to_py(compute_classification_metrics([]))
    return {
        "total_runs": total_runs,
        "evaluated_runs": 0,
        "running_or_incomplete_runs": total_runs,
        "gap_score": 0.0,
        "process_error_rate": 0.0,
        "outcome_error_rate": 0.0,
        "process_errors": 0,
        "outcome_errors": 0,
        "fully_compliant_runs": 0,
        "compliance_rate": 0.0,
        "avg_clause_coverage_score": 0.0,
        "avg_trajectory_score": 0.0,
        "h1_validation": h1_validation,
        "h2_validation": h2_validation,
        "classification_metrics": classification_metrics,
        "level_stats": {},
        "runs_by_autonomy_level": {},
        "h1_evidence": {"count": 0},
        "evidence_quality": {
            "minimum_runs_met": False,
            "ground_truth_fallback_runs": 0,
            "ground_truth_fallback_rate": 0.0,
            "transparency_artifact_rate": 0.0,
            "adk_invocation_attempted_runs": 0,
            "adk_invocation_rate": 0.0,
            "deterministic_fallback_runs": 0,
            "note": "No completed evaluation runs are available yet.",
        },
        "h3_validation": trust_status["h3_validation"],
        "h4_validation": trust_status["h4_validation"],
        "message": "No completed evaluation runs found.",
    }


async def _trust_status(session: AsyncSession) -> dict:
    result = await session.execute(select(TrustResponse))
    responses = result.scalars().all()
    by_run = {}
    for response in responses:
        by_run.setdefault(response.run_id, set()).add(response.transparency_condition)
    paired_runs = sum(1 for conditions in by_run.values() if {"outcome_only", "transparent"}.issubset(conditions))
    groups = {response.stakeholder_group for response in responses}
    return {
        "h3_validation": {
            "status": "instrumented" if not responses else "data_collection_started",
            "message": (
                "Stakeholder trust instrument is implemented; collect responses across stakeholder groups for H3."
                if not responses
                else f"{len(responses)} trust responses across {len(groups)} stakeholder groups are available."
            ),
        },
        "h4_validation": {
            "status": "instrumented" if paired_runs == 0 else "comparison_ready",
            "message": (
                "Outcome-only and transparent conditions are implemented; collect paired run responses for H4."
                if paired_runs == 0
                else f"{paired_runs} runs have both outcome-only and transparent trust responses."
            ),
        },
    }

async def get_h1_evidence(session: AsyncSession) -> dict:
    """
    H1 Evidence: runs where the final outcome is correct
    BUT the agent had process errors (skipped tools, etc.).
    """
    result = await session.execute(
        select(AgentRun).where(
            AgentRun.status == "completed",
            AgentRun.outcome_correct.is_not(None),
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
            select(AgentRun).where(
                AgentRun.status == "completed",
                AgentRun.outcome_correct.is_not(None),
                AgentRun.autonomy_level == level,
            )
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
    Baseline comparison endpoint.

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


async def get_metrics_over_time(session: AsyncSession) -> dict:
    """Return run-level metric history for dashboard trend charts."""
    result = await session.execute(select(AgentRun).order_by(AgentRun.started_at))
    runs = result.scalars().all()
    return {
        "data": [
            {
                "run_id": r.run_id,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "autonomy_level": r.autonomy_level,
                "outcome_correct": r.outcome_correct,
                "process_error_detected": r.process_error_detected,
                "clause_coverage_score": r.clause_coverage_score,
                "trajectory_score": r.trajectory_score,
                "tool_call_accuracy_score": r.tool_call_accuracy_score,
                "ground_truth_fallback_used": getattr(r, "ground_truth_fallback_used", False),
                "experiment_condition": getattr(r, "experiment_condition", "standard"),
            }
            for r in runs
        ]
    }
