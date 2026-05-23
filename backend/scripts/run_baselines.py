"""
scripts/run_baselines.py
=========================
Execute baseline evaluations and store results in database.

Usage:
    python scripts/run_baselines.py --type rule_based
    python scripts/run_baselines.py --type single_shot_llm
    python scripts/run_baselines.py --type all
"""

import argparse
import asyncio
import json
from pathlib import Path
import sys
from datetime import datetime, timezone
import uuid

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent.baselines import run_baseline_evaluation
from database.db import AsyncSessionLocal
from database.models import AgentRun


async def store_baseline_runs(baseline_type: str, results: list):
    """Store baseline run results in database."""
    level_map = {"rule_based": 0, "single_shot_llm": -1}
    autonomy_level = level_map[baseline_type]

    async with AsyncSessionLocal() as session:
        for idx, result in enumerate(results):
            now = datetime.now(timezone.utc)

            run = AgentRun(
                run_id=f"BASELINE-{baseline_type}-{uuid.uuid4()}",
                scenario_id=result.get("scenario_id", "UNKNOWN"),
                borrower_id=result.get("borrower_id", "UNKNOWN"),
                borrower_name=result.get("borrower_name"),
                autonomy_level=autonomy_level,
                pdf_path=result.get("pdf_path"),
                started_at=now,
                completed_at=now,
                duration_seconds=0.0,
                final_verdict=result["final_verdict"],
                correct_verdict=result.get("correct_verdict", "unknown"),
                outcome_correct=result.get("outcome_correct", False),
                trajectory_score=result.get("trajectory_score", 0.0),
                tool_call_accuracy_score=result.get("tool_call_accuracy_score", 1.0),
                clause_coverage_score=result["clause_coverage_score"],
                process_error_detected=result.get("process_error_detected", False),
                adjustment_clause_checked=result.get("adjustment_clause_checked", False),
                grace_period_clause_checked=result.get("grace_period_clause_checked", False),
                adjustment_changes_verdict=result.get("adjustment_changes_verdict", False),
                breach_severity_score=0.0,
                status="baseline",
                error_message=None,
         )
            session.add(run)

        await session.commit()

    print(f"✅ Stored {len(results)} {baseline_type} runs")

def load_scenarios():
    """Load test scenarios from the generated PDF catalog."""
    scenario_path = Path(__file__).parent.parent / "data" / "ground_truth.json"
    if not scenario_path.exists():
        print("❌ ground_truth.json not found. Run generate_scenarios.py first.")
        sys.exit(1)

    with open(scenario_path) as f:
        data = json.load(f)

    scenarios = []
    for s in data["scenarios"]:
        # Match generate_pdfs.py naming and folder
        pdf_filename = f"{s['borrower_id']}_{s['year']}_{s['quarter']}_Financial_Report.pdf"
        pdf_path = Path(__file__).parent.parent / "data" / "synthetic_pdfs" / pdf_filename

        scenarios.append({
            "scenario_id": s["scenario_id"],
            "borrower_id": s["borrower_id"],
            "pdf_path": str(pdf_path),
            "expected_verdict": s["expected_verdict"],
        })
    return scenarios

async def main():
    parser = argparse.ArgumentParser(description="Run baseline evaluations")
    parser.add_argument("--type", choices=["rule_based", "single_shot_llm", "all"], required=True)
    args = parser.parse_args()

    scenarios = load_scenarios()
    print(f"Loaded {len(scenarios)} scenarios")

    baseline_types = ["rule_based", "single_shot_llm"] if args.type == "all" else [args.type]

    for baseline_type in baseline_types:
        print(f"\nRunning {baseline_type} baseline...")
        results = run_baseline_evaluation(baseline_type, scenarios)

        correct = sum(1 for r in results if r.get("outcome_correct", False))
        accuracy = correct / len(results)
        avg_coverage = sum(r["clause_coverage_score"] for r in results) / len(results)

        print(f"  Accuracy: {accuracy*100:.1f}%")
        print(f"  Avg coverage: {avg_coverage*100:.1f}%")

        await store_baseline_runs(baseline_type, results)

    print("\n✅ Complete!")


if __name__ == "__main__":
    asyncio.run(main())
