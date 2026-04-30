"""
Tool: check_grace_period
Returns grace period and cure provision details for a borrower.
A grace period allows the borrower to cure a breach before it
becomes a formal Event of Default — a key distinction in legal
and regulatory terms.
"""

import json
from pathlib import Path


def check_grace_period(borrower_id: str) -> dict:
    """
    Returns grace period and cure provision details for the specified borrower.

    Under many facility agreements, a technical covenant breach does not
    immediately constitute an 'Event of Default'. The borrower may have a
    contractual right to cure the breach within a specified number of business
    days. Failing to check this provision can lead the bank to declare a formal
    default prematurely, which may have serious legal and reputational consequences.

    For Deutsche Bank's covenant monitoring:
    - A breach WITHOUT a grace period = immediate Event of Default trigger
    - A breach WITH a grace period = cure notice issued, 30–45 day window to rectify
    - Some grace periods are covenant-specific (e.g., liquidity only, not leverage)

    Args:
        borrower_id: The borrower's unique identifier (e.g. 'CORP-001').

    Returns:
        dict with grace period availability, duration, scope, and cure flag.
    """
    profiles_path = Path(__file__).parent.parent.parent / "data" / "borrower_profiles.json"

    if not profiles_path.exists():
        return {
            "has_grace_period": False,
            "grace_period_days": None,
            "grace_period_description": "borrower_profiles.json not found",
            "cure_available": False,
        }

    with open(profiles_path) as f:
        data = json.load(f)

    borrower = next(
        (b for b in data["borrowers"] if b["borrower_id"] == borrower_id),
        None
    )

    if not borrower:
        return {
            "has_grace_period": False,
            "grace_period_days": None,
            "grace_period_description": f"Borrower {borrower_id} not found",
            "cure_available": False,
        }

    has_grace = borrower.get("has_grace_period", False)
    description = borrower.get("grace_period_description") or ""
    desc_lower = description.lower()

    # Detect if the cure period is restricted to specific covenants.
    # Patterns: "liquidity only", "applies only to liquidity", "not to leverage", etc.
    liquidity_only = (
        "liquidity only" in desc_lower or
        "only to liquidity" in desc_lower or
        "not to leverage" in desc_lower
    )

    cure_leverage = has_grace and not liquidity_only
    cure_coverage = has_grace and not liquidity_only
    cure_liquidity = has_grace  # liquidity is always covered if grace period exists

    return {
        "has_grace_period": has_grace,
        "grace_period_days": borrower.get("grace_period_days"),
        "grace_period_description": description,
        "cure_available": has_grace,
        # Covenant-specific cure flags (used by breach_calculator)
        "cure_applies_to_leverage": cure_leverage,
        "cure_applies_to_coverage": cure_coverage,
        "cure_applies_to_liquidity": cure_liquidity,
    }
