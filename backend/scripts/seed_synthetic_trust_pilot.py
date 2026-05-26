"""
seed_synthetic_trust_pilot.py
=============================
Create a clearly labeled synthetic trust-study pilot for dashboard demos.

This does not create real stakeholder evidence. Rows are stored with
response_source="synthetic_demo" so the dashboard can present H3/H4 mechanics
without confusing demo data with actual survey responses.

Run from backend:
    python scripts/seed_synthetic_trust_pilot.py
"""

import asyncio
import random
import sys
import uuid
from pathlib import Path

from sqlalchemy import delete, select

sys.path.insert(0, str(Path(__file__).parent.parent))

from database.db import AsyncSessionLocal, init_db
from database.models import AgentRun, TrustResponse


RNG = random.Random(1407)
STAKEHOLDER_GROUPS = ("technical", "risk_compliance", "business", "non_technical")


def clamp_score(value: float) -> float:
    return round(max(1.0, min(7.0, value)), 1)


def synthetic_scores(run: AgentRun, condition: str, group: str, repeat: int) -> dict:
    """Create plausible synthetic ratings from run quality and visibility."""
    outcome_bonus = 0.55 if run.outcome_correct else -0.85
    process_penalty = -0.85 if run.process_error_detected else 0.25
    coverage_bonus = ((run.clause_coverage_score or 0.0) - 0.72) * 1.25
    transparent_bonus = 0.95 if condition == "transparent" else 0.0
    opacity_penalty = -0.45 if condition == "outcome_only" else 0.0
    risk_sensitivity = -0.25 if group == "risk_compliance" and run.process_error_detected else 0.0
    non_technical_visibility = 0.25 if group == "non_technical" and condition == "transparent" else 0.0
    small_noise = RNG.uniform(-0.35, 0.35) + (repeat * 0.05)

    trust = (
        4.15
        + outcome_bonus
        + process_penalty
        + coverage_bonus
        + transparent_bonus
        + opacity_penalty
        + risk_sensitivity
        + non_technical_visibility
        + small_noise
    )
    auditability = (
        3.25
        + (1.8 if condition == "transparent" else -0.35)
        + (0.35 if not run.process_error_detected else -0.4)
        + RNG.uniform(-0.25, 0.25)
    )
    reliability = (
        4.25
        + outcome_bonus
        + process_penalty
        + (0.35 if condition == "transparent" else 0.0)
        + RNG.uniform(-0.3, 0.3)
    )
    explanation = (
        3.35
        + (1.65 if condition == "transparent" else -0.3)
        + (0.25 if group in {"technical", "risk_compliance"} else 0.0)
        + RNG.uniform(-0.3, 0.3)
    )

    return {
        "trust_score": clamp_score(trust),
        "auditability_score": clamp_score(auditability),
        "reliability_score": clamp_score(reliability),
        "explanation_sufficiency_score": clamp_score(explanation),
    }


async def main():
    await init_db()

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AgentRun)
            .where(AgentRun.autonomy_level.in_([1, 2, 3]))
            .order_by(AgentRun.autonomy_level, AgentRun.started_at)
        )
        runs = result.scalars().all()

        if not runs:
            print("No agent runs found. Run scripts/seed_demo_runs.py first.")
            return

        selected_runs = runs[:12]

        await session.execute(
            delete(TrustResponse).where(TrustResponse.response_source == "synthetic_demo")
        )

        created = 0
        for run_index, run in enumerate(selected_runs):
            for condition in ("outcome_only", "transparent"):
                for repeat in range(2):
                    group = STAKEHOLDER_GROUPS[(run_index + repeat) % len(STAKEHOLDER_GROUPS)]
                    scores = synthetic_scores(run, condition, group, repeat)
                    session.add(
                        TrustResponse(
                            response_id=str(uuid.uuid4()),
                            run_id=run.run_id,
                            stakeholder_group=group,
                            transparency_condition=condition,
                            response_source="synthetic_demo",
                            comments=(
                                "Synthetic demo response for thesis dashboard; "
                                "not collected from a real stakeholder."
                            ),
                            **scores,
                        )
                    )
                    created += 1

        await session.commit()

    print(f"Seeded {created} synthetic_demo trust responses across {len(selected_runs)} runs.")
    print("Dashboard H3/H4 evidence is now synthetic pilot evidence, not real survey evidence.")


if __name__ == "__main__":
    asyncio.run(main())
