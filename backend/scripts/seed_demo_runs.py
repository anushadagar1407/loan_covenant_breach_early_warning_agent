"""
seed_demo_runs.py
=================
Seeds the database with controlled pilot runs for all 10 scenarios
across all 3 autonomy levels. Used for thesis validation walkthroughs.

Run: python scripts/seed_demo_runs.py

Simulated skip patterns per autonomy level:
  Level 1: no skips (all tools called)
  Level 2: skips check_accounting_adjustments ~40% of the time (for borrowers with adjustments)
  Level 3: always skips check_accounting_adjustments (for borrowers with adjustments),
           also skips check_grace_period ~50% of the time

This mimics the real-world behaviour where higher-autonomy agents are more
likely to take shortcuts — which is the core of H2.
"""

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent.agent_runner import run_agent_with_metrics
from database.db import init_db, get_db
from database.models import AgentRun, ToolCallEvent, AuditLogEntry
from sqlalchemy import insert


# Which tool to skip per (autonomy_level, borrower_has_adjustments, run_index)
# run_index used to vary L2 behaviour deterministically
SKIP_PATTERNS = {
    1: lambda has_adj, has_gp, i: "",                              # always run all tools
    2: lambda has_adj, has_gp, i: (                                # sometimes skips
        "check_accounting_adjustments" if has_adj and i % 2 == 1
        else ("check_grace_period" if has_gp and i % 3 == 0 else "")
    ),
    3: lambda has_adj, has_gp, i: (                                # often skips
        "check_accounting_adjustments" if has_adj else
        ("check_grace_period" if has_gp and i % 2 == 0 else "")
    ),
}


async def save_run(db_session, result: dict):
    """Persist a run result to the database."""
    from datetime import datetime, timezone

    def _parse_dt(s):
        if not s:
            return None
        try:
            return datetime.fromisoformat(s)
        except Exception:
            return None

    run_row = {
        "run_id": result["run_id"],
        "scenario_id": result["scenario_id"],
        "borrower_id": result["borrower_id"],
        "borrower_name": result["borrower_name"],
        "autonomy_level": result["autonomy_level"],
        "pdf_path": result["pdf_path"],
        "started_at": _parse_dt(result["started_at"]),
        "completed_at": _parse_dt(result["completed_at"]),
        "duration_seconds": result["duration_seconds"],
        "final_verdict": result["final_verdict"],
        "correct_verdict": result["correct_verdict"],
        "outcome_correct": result["outcome_correct"],
        "trajectory_score": result["trajectory_score"],
        "tool_call_accuracy_score": result["tool_call_accuracy_score"],
        "clause_coverage_score": result["clause_coverage_score"],
        "process_error_detected": result["process_error_detected"],
        "data_source": result.get("data_source"),
        "ground_truth_fallback_used": result.get("ground_truth_fallback_used", False),
        "transparency_artifacts_present": result.get("transparency_artifacts_present", False),
        "execution_mode": result.get("execution_mode"),
        "adk_invocation_attempted": result.get("research_signals", {}).get("adk_invocation_attempted", False),
        "deterministic_fallback_used": result.get("research_signals", {}).get("deterministic_fallback_used", False),
        "adjustment_clause_checked": result["adjustment_clause_checked"],
        "grace_period_clause_checked": result["grace_period_clause_checked"],
        "adjustment_changes_verdict": result["adjustment_changes_verdict"],
        "breach_severity_score": 0.0,
        "status": result["status"],
        "error_message": result.get("error_message"),
    }
    await db_session.execute(insert(AgentRun).values(**run_row))

    for event in result.get("tool_call_events", []):
        from datetime import datetime
        event_row = {k: v for k, v in event.items() if k != "_start_time"}
        for dt_field in ("called_at", "completed_at"):
            if isinstance(event_row.get(dt_field), str):
                event_row[dt_field] = _parse_dt(event_row[dt_field])
        await db_session.execute(insert(ToolCallEvent).values(**event_row))

    for entry in result.get("audit_log_entries", []):
        entry_row = dict(entry)
        if isinstance(entry_row.get("timestamp"), str):
            entry_row["timestamp"] = _parse_dt(entry_row["timestamp"])
        await db_session.execute(insert(AuditLogEntry).values(**entry_row))

    await db_session.commit()


async def main():
    await init_db()

    with open("data/ground_truth.json") as f:
        gt = json.load(f)
    with open("data/borrower_profiles.json") as f:
        profiles = json.load(f)

    borrower_map = {b["borrower_id"]: b for b in profiles["borrowers"]}

    total = 0
    errors = 0

    print("Seeding controlled pilot runs (10 scenarios x 3 autonomy levels = 30 runs)\n")

    for level in [1, 2, 3]:
        for i, scen in enumerate(gt["scenarios"][:10]):  # keep 10 scenarios if you want 30 runs
            sid = scen["scenario_id"]
            bid = scen["borrower_id"]
            profile = borrower_map.get(bid, {})
            has_adj = profile.get("has_accounting_adjustments", False)
            has_gp = profile.get("has_grace_period", False)

            skip = SKIP_PATTERNS[level](has_adj, has_gp, i)

            # Build PDF filename to match generate_pdfs.py
            borrower_id = scen["borrower_id"]
            year = scen["year"]          # e.g. 2026
            quarter = scen["quarter"]    # e.g. "Q1"
            filename = f"{borrower_id}_{year}_{quarter}_Financial_Report.pdf"
            pdf = f"data/synthetic_pdfs/{filename}"

            try:
                result = await run_agent_with_metrics(
                    scenario_id=sid,
                    borrower_id=bid,
                    pdf_path=pdf,
                    autonomy_level=level,
                    ground_truth=scen,
                    simulate_skip_tool=skip,
                )

                async for db in get_db():
                    await save_run(db, result)

                status_icon = "✓" if result["outcome_correct"] else "✗"
                cover_icon = "✓" if result["clause_coverage_score"] >= 1.0 else "⚠"
                print(
                    f"  L{level} {sid} [{bid}]  "
                    f"verdict={result['final_verdict']:<16} "
                    f"outcome={status_icon}  "
                    f"coverage={result['clause_coverage_score']:.2f}{cover_icon}  "
                    f"skip={skip or 'none'}"
                )
                total += 1

            except Exception as e:
                print(f"  L{level} {sid} ERROR: {e}")
                errors += 1

        print()

    print(f"\nSeeding complete: {total} runs saved, {errors} errors.")
    print("\nH2 summary (expected pattern):")
    print("  Level 1: clause_coverage = 1.00 for all runs")
    print("  Level 2: clause_coverage < 1.00 for some runs")
    print("  Level 3: clause_coverage < 1.00 for most adjustment-heavy runs")


if __name__ == "__main__":
    asyncio.run(main())
