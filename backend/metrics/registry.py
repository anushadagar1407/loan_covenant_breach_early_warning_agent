"""UPDATED registry with statistical validation"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database.models import AgentRun
from metrics.statistical_analysis import (
    validate_h1_gap_score,
    validate_h2_autonomy_errors,
    compute_classification_metrics,
    compare_approaches
)

async def get_registry_summary(session: AsyncSession) -> dict:
    """Get comprehensive registry summary with statistical validation."""
    result = await session.execute(select(AgentRun))
    runs = result.scalars().all()
    
    if len(runs) == 0:
        return {"total_runs": 0, "message": "No runs found"}
    
    total_runs = len(runs)
    process_errors = sum(1 for r in runs if r.process_error_detected)
    outcome_errors = sum(1 for r in runs if not r.outcome_correct)
    fully_compliant = sum(1 for r in runs if r.clause_coverage_score >= 1.0)
    
    process_error_rate = process_errors / total_runs
    outcome_error_rate = outcome_errors / total_runs
    gap_score = process_error_rate - outcome_error_rate
    avg_coverage = sum(r.clause_coverage_score for r in runs) / total_runs
    avg_trajectory = sum(r.trajectory_score or 0 for r in runs) / total_runs
    
    h1_validation = validate_h1_gap_score(runs)
    h2_validation = validate_h2_autonomy_errors(runs)
    classification_metrics = compute_classification_metrics(runs)
    
    level_stats = {}
    for level in [1, 2, 3]:
        level_runs = [r for r in runs if r.autonomy_level == level]
        if len(level_runs) > 0:
            level_stats[f"level_{level}"] = {
                "count": len(level_runs),
                "process_error_rate": sum(1 for r in level_runs if r.process_error_detected) / len(level_runs),
                "avg_coverage": sum(r.clause_coverage_score for r in level_runs) / len(level_runs),
                "outcome_accuracy": sum(1 for r in level_runs if r.outcome_correct) / len(level_runs)
            }
    
    return {
        "total_runs": total_runs,
        "gap_score": gap_score,
        "process_error_rate": process_error_rate,
        "outcome_error_rate": outcome_error_rate,
        "process_errors": process_errors,
        "outcome_errors": outcome_errors,
        "fully_compliant_runs": fully_compliant,
        "avg_clause_coverage_score": avg_coverage,
        "avg_trajectory_score": avg_trajectory,
        "h1_validation": h1_validation,
        "h2_validation": h2_validation,
        "classification_metrics": classification_metrics,
        "level_stats": level_stats,
    }
