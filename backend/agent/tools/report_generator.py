"""
Tool: generate_report
Compiles all upstream tool outputs into a structured final report.
This is the last step the agent calls. The report forms the audit record
for the covenant check — it must capture which steps were completed.
"""

import uuid
from datetime import datetime, timezone
import json


def generate_report(
    scenario_id: str,
    borrower_id: str,
    extraction_result: dict,
    covenant_result: dict,
    adjustment_result: dict,
    grace_period_result: dict,
    breach_result: dict,
) -> dict:
    """
    Compiles all covenant analysis results into a structured final report
    with a full audit summary. This report serves as the formal record of
    the covenant check for compliance and audit purposes.

    In Deutsche Bank's context, this report would be submitted to the
    Credit Risk team and stored in the loan management system. The
    'process_steps_completed' field is critical — it records WHICH tools
    were called, enabling auditors to verify that all required checks
    were performed. A report missing 'check_accounting_adjustments' from
    this list would flag a compliance gap.

    Args:
        scenario_id: The test scenario identifier.
        borrower_id: The borrower's unique identifier.
        extraction_result: Output from extract_financial_metrics.
        covenant_result: Output from identify_applicable_covenants.
        adjustment_result: Output from check_accounting_adjustments.
        grace_period_result: Output from check_grace_period.
        breach_result: Output from calculate_breach_risk.

    Returns:
        dict with full structured report including verdict, metrics,
        completed steps, and recommended action.
    """
    report_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()

    def _coerce_dict(value, fallback=None):
        if fallback is None:
            fallback = {}
        if isinstance(value, dict):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                return parsed if isinstance(parsed, dict) else fallback
            except Exception:
                return fallback
        return fallback

    extraction_result = _coerce_dict(extraction_result)
    covenant_result = _coerce_dict(covenant_result)
    adjustment_result = _coerce_dict(adjustment_result)
    grace_period_result = _coerce_dict(grace_period_result)
    breach_result = _coerce_dict(breach_result, {"verdict": str(breach_result) if breach_result is not None else "unknown"})

    verdict = breach_result.get("verdict", "unknown")
    severity = breach_result.get("breach_severity_score", 0.0)
    adjustment_applied = adjustment_result.get("adjustments_applicable", False)
    grace_available = grace_period_result.get("has_grace_period", False)

    # Determine recommended action
    if verdict == "no_breach":
        recommended_action = "No action required. Continue standard monitoring."
    elif verdict == "imminent":
        recommended_action = (
            "Flag for enhanced monitoring. Notify Relationship Manager. "
            "Request updated projections from borrower."
        )
    elif verdict == "breach_curable":
        grace_days = grace_period_result.get("grace_period_days", "N/A")
        recommended_action = (
            f"Issue cure notice to borrower within 5 business days. "
            f"Cure period: {grace_days} business days. "
            "Escalate to Credit Risk team."
        )
    elif verdict == "breach":
        recommended_action = (
            "IMMEDIATE ACTION REQUIRED: Declare Event of Default. "
            "Notify Legal, Credit Risk, and Relationship Management. "
            "Freeze further drawdowns."
        )
    else:
        recommended_action = "Review required — verdict could not be determined."

    # Record which process steps were actually executed
    process_steps_completed = []
    if extraction_result and not extraction_result.get("source") == "error":
        process_steps_completed.append("extract_financial_metrics")
    if covenant_result and "covenants" in covenant_result:
        process_steps_completed.append("identify_applicable_covenants")
    if adjustment_result and "adjustments_applicable" in adjustment_result:
        process_steps_completed.append("check_accounting_adjustments")
    if grace_period_result and "has_grace_period" in grace_period_result:
        process_steps_completed.append("check_grace_period")
    if breach_result and "verdict" in breach_result:
        process_steps_completed.append("calculate_breach_risk")
    process_steps_completed.append("generate_report")

    # Build audit summary
    adj_note = ""
    if adjustment_applied:
        adj_note = (
            f" Permitted accounting adjustments were applied: "
            f"{adjustment_result.get('adjustment_notes', 'see adjustment details')}."
        )

    grace_note = ""
    if grace_available and verdict in ("breach", "breach_curable"):
        grace_note = (
            f" A {grace_period_result.get('grace_period_days')}-day cure period is available."
        )

    audit_summary = (
        f"Covenant check completed for {covenant_result.get('borrower_name', borrower_id)} "
        f"(Scenario: {scenario_id}). "
        f"Verdict: {verdict.upper().replace('_', ' ')}. "
        f"Debt/EBITDA: {breach_result.get('debt_to_ebitda', 0):.2f}x, "
        f"Interest Coverage: {breach_result.get('interest_coverage', 0):.2f}x, "
        f"Liquidity: {breach_result.get('liquidity_ratio', 0):.2f}x."
        f"{adj_note}{grace_note} "
        f"Process steps completed: {len(process_steps_completed)}/6."
    )

    return {
        "report_id": report_id,
        "scenario_id": scenario_id,
        "borrower_id": borrower_id,
        "borrower_name": covenant_result.get("borrower_name", borrower_id),
        "timestamp": timestamp,
        "final_verdict": verdict,
        "breach_severity_score": severity,
        "key_metrics": {
            "debt_to_ebitda": breach_result.get("debt_to_ebitda", 0),
            "interest_coverage": breach_result.get("interest_coverage", 0),
            "liquidity_ratio": breach_result.get("liquidity_ratio", 0),
        },
        "covenant_thresholds": covenant_result.get("covenants", {}),
        "covenant_status": breach_result.get("covenant_status", {}),
        "risk_flags": breach_result.get("risk_flags", []),
        "process_steps_completed": process_steps_completed,
        "adjustment_applied": adjustment_applied,
        "adjustment_notes": adjustment_result.get("adjustment_notes", ""),
        "grace_period_available": grace_available,
        "grace_period_days": grace_period_result.get("grace_period_days"),
        "recommended_action": recommended_action,
        "audit_summary": audit_summary,
        "extraction_confidence": extraction_result.get("extraction_confidence", 0),
    }
