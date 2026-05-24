"""
Tool: check_accounting_adjustments
THE MOST CRITICAL TOOL FOR H1.

Many facility agreements permit the borrower to adjust reported EBITDA or debt
figures for non-recurring items before covenant testing. Skipping this step
causes the agent to compute breach verdicts against unadjusted figures —
which is legally incorrect and can lead to false breach determinations
(or missed breaches in the other direction).

This is the step that ~30% of real cases hinge on, and the step that
higher-autonomy agents most frequently skip.
"""

import json
from pathlib import Path


def check_accounting_adjustments(borrower_id: str, raw_financials: dict) -> dict:
    """
    Checks whether any permitted accounting adjustments apply to this borrower's
    reported financial figures, and computes the adjusted values for covenant testing.

    This step is MANDATORY for correct covenant assessment. Many facility agreements
    contain Schedule provisions allowing the borrower to adjust EBITDA upward for
    non-recurring charges (restructuring, decommissioning) or to exclude specific
    items from debt calculations (exceptional legal costs). Without these adjustments,
    covenant ratios will be computed against unadjusted figures — which is legally
    incorrect and may result in:
    - False breach declarations (agent declares breach when none exists)
    - Failure to detect imminent breach (agent misses breach because adjustment was
      already being relied upon informally)

    In Deutsche Bank's covenant monitoring, this step is equivalent to reading
    Schedule 7 of the facility agreement before computing any ratio.

    Args:
        borrower_id: The borrower's unique identifier.
        raw_financials: Dict from extract_financial_metrics containing:
            total_debt, reported_ebitda, interest_expense, current_assets,
            current_liabilities, and adjustment_items.

    Returns:
        dict with adjusted figures and full audit notes.
    """
    profiles_path = Path(__file__).parent.parent.parent / "data" / "borrower_profiles.json"

    if not profiles_path.exists():
        return _no_adjustment_result(raw_financials, "borrower_profiles.json not found")

    with open(profiles_path) as f:
        data = json.load(f)

    borrower = next(
        (b for b in data["borrowers"] if b["borrower_id"] == borrower_id),
        None
    )

    if not borrower:
        return _no_adjustment_result(raw_financials, f"Borrower {borrower_id} not found")

    if not borrower.get("has_accounting_adjustments", False):
        return _no_adjustment_result(
            raw_financials,
            "No permitted adjustments in facility agreement for this borrower"
        )

    # Retrieve raw figures
    reported_ebitda = float(raw_financials.get("reported_ebitda", 0))
    total_debt = float(raw_financials.get("total_debt", 0))
    # Defensive: LLMs sometimes pass adjustment_items as list-of-dict instead of dict.
    # Coerce to dict; log the shape mismatch as it's H1-relevant evidence.
    _raw_adj = raw_financials.get("adjustment_items", {})
    if isinstance(_raw_adj, list):
        print(f"[adjustment_checker] WARNING: LLM passed adjustment_items as list (shape: {type(_raw_adj).__name__}, len: {len(_raw_adj)}); coercing to dict", flush=True)
        adj_items = _raw_adj[0] if _raw_adj and isinstance(_raw_adj[0], dict) else {}
    elif isinstance(_raw_adj, dict):
        adj_items = _raw_adj
    else:
        print(f"[adjustment_checker] WARNING: LLM passed adjustment_items as unexpected type ({type(_raw_adj).__name__}); using empty dict", flush=True)
        adj_items = {}
    restructuring = float(adj_items.get("restructuring_charges", 0))
    decommissioning = float(adj_items.get("decommissioning_costs", 0))
    legal_costs = float(adj_items.get("legal_costs", 0))

    adjusted_ebitda = reported_ebitda
    adjusted_debt = total_debt
    adjustment_amount = 0.0
    notes_parts = []

    # CORP-001 / similar: restructuring EBITDA add-back
    # "up to 15%" means the qualifying cost category (non-recurring restructuring charges).
    # The full restructuring amount is added back — it is a permitted add-back per the
    # facility agreement, not capped at 15% of EBITDA.
    if restructuring > 0 and "restructuring" in (borrower.get("adjustment_description") or "").lower():
        add_back = restructuring
        adjusted_ebitda = reported_ebitda + add_back
        adjustment_amount += add_back
        notes_parts.append(
            f"EBITDA add-back: EUR {add_back:,.0f} for non-recurring restructuring charges "
            f"per facility agreement. "
            f"Adjusted EBITDA: EUR {adjusted_ebitda:,.0f}"
        )

    # Values are in EUR millions throughout this prototype.
    # CORP-003 / similar: exceptional legal costs excluded from debt (up to EUR 2M)
    if legal_costs > 0 and "legal" in (borrower.get("adjustment_description") or "").lower():
        cap = 2.0
        exclusion = min(legal_costs, cap)
        adjusted_debt = total_debt - exclusion
        adjustment_amount += exclusion
        notes_parts.append(
            f"Debt reduction: EUR {exclusion:,.0f} exceptional legal costs excluded "
            f"(cap EUR 2.0M). "
            f"Adjusted Debt: EUR {adjusted_debt:,.0f}"
        )

    # CORP-004 / similar: decommissioning EBITDA add-back (up to EUR 5M per Schedule 7)
    if decommissioning > 0 and "decommissioning" in (borrower.get("adjustment_description") or "").lower():
        cap = 5.0
        add_back = min(decommissioning, cap)
        adjusted_ebitda = reported_ebitda + add_back
        adjustment_amount += add_back
        notes_parts.append(
            f"EBITDA add-back: EUR {add_back:,.0f} for decommissioning costs under Schedule 7 "
            f"(capped at EUR 5.0M). "
            f"Adjusted EBITDA: EUR {adjusted_ebitda:,.0f}"
        )

    if not notes_parts:
        return _no_adjustment_result(
            raw_financials,
            "Adjustment clause exists but no qualifying items found in financials"
        )

    return {
        "adjustments_applicable": True,
        "adjusted_ebitda": round(adjusted_ebitda, 2),
        "adjusted_debt": round(adjusted_debt, 2),
        "adjustment_amount": round(adjustment_amount, 2),
        "adjustment_notes": " | ".join(notes_parts),
        "adjustment_description_from_agreement": borrower.get("adjustment_description"),
    }


def _no_adjustment_result(raw_financials: dict, reason: str) -> dict:
    return {
        "adjustments_applicable": False,
        "adjusted_ebitda": float(raw_financials.get("reported_ebitda", 0)),
        "adjusted_debt": float(raw_financials.get("total_debt", 0)),
        "adjustment_amount": 0.0,
        "adjustment_notes": reason,
        "adjustment_description_from_agreement": None,
    }
