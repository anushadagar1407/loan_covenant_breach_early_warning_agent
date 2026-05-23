"""
metrics/clause_coverage_scorer.py
===================================
Metric 3: Clause Coverage Score — THE KEY H1 METRIC

Measures whether the agent checked all legally required clauses for the
specific borrower. This is the "smoking gun" for Hypothesis H1.

If a borrower has accounting adjustment clauses and the agent didn't check
them, the outcome could be wrong in ~30% of real cases. Even when it happens
to be correct by chance, the process was non-compliant — it cannot be
audited, defended in court, or relied upon for risk management.

Clause coverage < 1.0 with outcome_correct = True is the defining evidence
for H1: outcome metrics mask process risk.
"""

from typing import List


REQUIRED_ALWAYS = [
    "extract_financial_metrics",
    "identify_applicable_covenants",
    "calculate_breach_risk",
    "generate_report",
]

REQUIRED_IF_ADJUSTMENTS = "check_accounting_adjustments"
REQUIRED_IF_GRACE_PERIOD = "check_grace_period"


def compute_clause_coverage(
    tools_called: List[str],
    borrower_has_adjustments: bool,
    borrower_has_grace_period: bool,
) -> dict:
    """
    Computes the clause coverage score for an agent run — the percentage of
    legally required checks that were actually performed.

    Required checks are:
    - Always: extract_financial_metrics, identify_applicable_covenants,
               calculate_breach_risk, generate_report
    - When borrower has adjustment clauses: check_accounting_adjustments
    - When borrower has grace period: check_grace_period

    A clause_coverage_score < 1.0 indicates that the agent skipped at least
    one legally required check. When combined with outcome_correct = True,
    this is direct evidence for H1.

    Args:
        tools_called: Ordered list of tool names the agent actually called.
        borrower_has_adjustments: True if borrower has accounting adjustment clauses.
        borrower_has_grace_period: True if borrower has grace period provisions.

    Returns:
        dict with clause_coverage_score, per-clause check results,
        coverage_gap description, and h1_relevant flag.
    """
    called_set = set(tools_called)

    # Build required set
    required = list(REQUIRED_ALWAYS)
    if borrower_has_adjustments:
        required.append(REQUIRED_IF_ADJUSTMENTS)
    if borrower_has_grace_period:
        required.append(REQUIRED_IF_GRACE_PERIOD)

    # Per-clause results
    adjustment_checked = REQUIRED_IF_ADJUSTMENTS in called_set
    grace_period_checked = REQUIRED_IF_GRACE_PERIOD in called_set
    financial_complete = "extract_financial_metrics" in called_set
    covenants_identified = "identify_applicable_covenants" in called_set
    risk_calculated = "calculate_breach_risk" in called_set
    report_generated = "generate_report" in called_set

    # Count coverage
    checked_count = sum([
        int(financial_complete),
        int(covenants_identified),
        int(risk_calculated),
        int(report_generated),
        int(adjustment_checked) if borrower_has_adjustments else 0,
        int(grace_period_checked) if borrower_has_grace_period else 0,
    ])
    total_required = 4 + (1 if borrower_has_adjustments else 0) + (1 if borrower_has_grace_period else 0)

    clause_coverage_score = round(checked_count / total_required, 4)

    # Build human-readable gap description
    gaps = []
    if borrower_has_adjustments and not adjustment_checked:
        gaps.append(
            "CRITICAL: Accounting adjustment clause not checked. "
            "This borrower has permitted EBITDA/debt adjustments under their facility agreement. "
            "Without checking this clause, ratio calculations may be legally incorrect."
        )
    if borrower_has_grace_period and not grace_period_checked:
        gaps.append(
            "Grace period clause not checked. "
            "This borrower may have cure rights that prevent immediate Event of Default. "
            "Failing to check could result in premature default declaration."
        )
    if not financial_complete:
        gaps.append("Financial metrics extraction was not completed.")
    if not covenants_identified:
        gaps.append("Applicable covenants were not identified from the facility agreement.")

    coverage_gap = " | ".join(gaps) if gaps else "No coverage gaps — all required clauses checked."

    # H1 relevance: coverage < 1.0 but outcome was still correct
    # (the caller sets outcome_correct — we just flag the potential)
    h1_relevant = clause_coverage_score < 1.0 and borrower_has_adjustments and not adjustment_checked

    return {
        "clause_coverage_score": clause_coverage_score,
        "total_required_checks": total_required,
        "checks_completed": checked_count,
        "adjustment_clause_checked": adjustment_checked,
        "grace_period_clause_checked": grace_period_checked,
        "financial_extraction_complete": financial_complete,
        "covenants_identified": covenants_identified,
        "breach_risk_calculated": risk_calculated,
        "report_generated": report_generated,
        "coverage_gap": coverage_gap,
        "h1_relevant": h1_relevant,
        "borrower_has_adjustments": borrower_has_adjustments,
        "borrower_has_grace_period": borrower_has_grace_period,
    }
