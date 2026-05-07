"""
metrics/registry.py
====================
Central Agent Registry — aggregates all run metrics for the dashboard.

This is the transparency mechanism for Hypothesis H4. By centralizing
process-level metrics into a queryable registry, stakeholders gain visibility
into HOW the agent operates, not just WHAT it concludes. This visibility
is what H4 claims increases trust.

The Gap Score (Process Error Rate - Outcome Error Rate) is the central
thesis visualization: it proves H1 by showing that traditional metrics
(outcome error rate) systematically underreport the true failure rate.
"""

from typing import List


def compute_registry_summary(runs: List[dict]) -> dict:
    """
    Computes aggregated metrics across all agent runs for the registry dashboard.

    The 'gap_score' is the key thesis number: it represents the difference between
    how often the agent makes a process error versus how often it gets the wrong
    answer. A positive gap proves H1 — traditional metrics underreport true failures.

    Args:
        runs: List of run dicts from the agent_runs database table.

    Returns:
        dict with aggregated metrics, autonomy-level breakdowns, and H1/H2 evidence.
    """
    if not runs:
        return _empty_summary()

    total = len(runs)
    outcome_errors = sum(1 for r in runs if not r.get("outcome_correct", True))
    process_errors = sum(1 for r in runs if r.get("process_error_detected", False))

    outcome_error_rate = round(outcome_errors / total, 4)
    process_error_rate = round(process_errors / total, 4)
    gap_score = round(process_error_rate - outcome_error_rate, 4)

    avg_trajectory = _safe_mean([r.get("trajectory_score") or 0 for r in runs])
    avg_coverage = _safe_mean([r.get("clause_coverage_score") or 0 for r in runs])
    avg_tool_accuracy = _safe_mean([r.get("tool_call_accuracy_score") or 0 for r in runs])

    # Breakdown by autonomy level
    runs_by_level = {}
    for level in [1, 2, 3]:
        level_runs = [r for r in runs if r.get("autonomy_level") == level]
        if level_runs:
            runs_by_level[str(level)] = {
                "count": len(level_runs),
                "avg_clause_coverage": _safe_mean(
                    [r.get("clause_coverage_score") or 0 for r in level_runs]
                ),
                "avg_trajectory": _safe_mean(
                    [r.get("trajectory_score") or 0 for r in level_runs]
                ),
                "process_error_rate": round(
                    sum(1 for r in level_runs if r.get("process_error_detected")) / len(level_runs), 4
                ),
                "outcome_error_rate": round(
                    sum(1 for r in level_runs if not r.get("outcome_correct", True)) / len(level_runs), 4
                ),
            }
        else:
            runs_by_level[str(level)] = {
                "count": 0,
                "avg_clause_coverage": 0,
                "avg_trajectory": 0,
                "process_error_rate": 0,
                "outcome_error_rate": 0,
            }

    # H1 evidence: correct outcome but process error detected
    h1_runs = [
        r for r in runs
        if r.get("outcome_correct", True) and r.get("process_error_detected", False)
    ]

    return {
        "total_runs": total,
        "outcome_errors": outcome_errors,
        "process_errors": process_errors,
        "outcome_error_rate": outcome_error_rate,
        "process_error_rate": process_error_rate,
        "gap_score": gap_score,
        "avg_trajectory_score": avg_trajectory,
        "avg_clause_coverage_score": avg_coverage,
        "avg_tool_accuracy_score": avg_tool_accuracy,
        "fully_compliant_runs": sum(
            1 for r in runs if (r.get("clause_coverage_score") or 0) >= 1.0
        ),
        "compliance_rate": round(
            sum(1 for r in runs if (r.get("clause_coverage_score") or 0) >= 1.0) / total, 4
        ),
        "runs_by_autonomy_level": runs_by_level,
        "h1_evidence": {
            "count": len(h1_runs),
            "percentage": round(len(h1_runs) / total * 100, 1),
            "run_ids": [r.get("run_id") for r in h1_runs],
            "description": (
                "Runs where the agent returned a CORRECT final verdict "
                "but SKIPPED at least one legally required process step. "
                "These are invisible to outcome-only evaluation."
            ),
        },
    }


def _safe_mean(values: List[float]) -> float:
    valid = [v for v in values if v is not None]
    return round(sum(valid) / len(valid), 4) if valid else 0.0


def _empty_summary() -> dict:
    return {
        "total_runs": 0,
        "outcome_errors": 0,
        "process_errors": 0,
        "outcome_error_rate": 0.0,
        "process_error_rate": 0.0,
        "gap_score": 0.0,
        "avg_trajectory_score": 0.0,
        "avg_clause_coverage_score": 0.0,
        "avg_tool_accuracy_score": 0.0,
        "fully_compliant_runs": 0,
        "compliance_rate": 0.0,
        "runs_by_autonomy_level": {"1": {}, "2": {}, "3": {}},
        "h1_evidence": {"count": 0, "percentage": 0.0, "run_ids": [], "description": ""},
    }
