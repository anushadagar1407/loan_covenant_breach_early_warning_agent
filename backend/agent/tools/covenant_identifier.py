"""
Tool: identify_applicable_covenants
Returns the legally applicable covenant thresholds for a borrower
from their facility agreement, stored in borrower_profiles.json.
"""

import json
from pathlib import Path


def identify_applicable_covenants(borrower_id: str) -> dict:
    """
    Returns the legally applicable covenant thresholds for a specific borrower,
    as defined in their facility agreement.

    Covenants are legal obligations embedded in the loan agreement. They define
    the maximum or minimum financial ratios the borrower must maintain. This tool
    retrieves the binding thresholds for this specific borrower — different
    borrowers have different covenants negotiated at origination.

    Covenant types returned:
    - max_debt_to_ebitda: Maximum leverage ratio (Total Debt / EBITDA)
    - min_interest_coverage: Minimum coverage ratio (EBITDA / Interest Expense)
    - min_liquidity_ratio: Minimum liquidity (Current Assets / Current Liabilities)

    Args:
        borrower_id: The borrower's unique identifier (e.g. 'CORP-001').

    Returns:
        dict with borrower identity, covenant thresholds, and adjustment flags.
    """
    profiles_path = Path(__file__).parent.parent.parent / "data" / "borrower_profiles.json"

    if not profiles_path.exists():
        return {
            "error": f"borrower_profiles.json not found at {profiles_path}",
            "borrower_id": borrower_id,
        }

    with open(profiles_path) as f:
        data = json.load(f)

    borrower = next(
        (b for b in data["borrowers"] if b["borrower_id"] == borrower_id),
        None
    )

    if not borrower:
        return {
            "error": f"Borrower {borrower_id} not found in profiles",
            "borrower_id": borrower_id,
        }

    return {
        "borrower_id": borrower["borrower_id"],
        "borrower_name": borrower["name"],
        "covenants": borrower["covenants"],
        "has_accounting_adjustments": borrower["has_accounting_adjustments"],
        "adjustment_description": borrower.get("adjustment_description"),
        "has_grace_period": borrower["has_grace_period"],
        "grace_period_days": borrower.get("grace_period_days"),
    }
