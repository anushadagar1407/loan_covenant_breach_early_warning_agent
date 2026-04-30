"""
metrics/tool_accuracy_scorer.py
================================
Metric 2: Tool Call Accuracy Score

Scores whether each tool was called with valid, non-hallucinated arguments
and returned a valid result. Links to H1.

An agent may call the right tools but pass in fabricated parameters or
receive error responses. This is a process error invisible to outcome-only
evaluation — the final verdict may still be computed correctly from other
tools, but the individual tool call was unreliable.
"""

from typing import Any


VALID_BORROWER_IDS = {"CORP-001", "CORP-002", "CORP-003", "CORP-004", "CORP-005"}
VALID_VERDICTS = {"no_breach", "imminent", "breach", "breach_curable"}


def score_tool_call_accuracy(
    tool_name: str,
    args: dict,
    result: dict,
    scenario_data: dict | None = None,
) -> dict:
    """
    For a single tool call, scores whether the arguments were valid (not
    hallucinated) and whether the result was meaningful.

    Ground-truth comparison (when scenario_data is provided) checks whether
    extracted financial values are within 5% of expected figures.

    Args:
        tool_name: Name of the tool that was called.
        args: Arguments passed to the tool.
        result: Value returned by the tool.
        scenario_data: Optional ground truth scenario dict for comparison.

    Returns:
        dict with accuracy_score, args_valid, returned_result, and notes.
    """
    notes = []
    checks_passed = 0
    total_checks = 0

    # ── 1. Result exists and is not an error ──────────────────────────────
    total_checks += 1
    if result and isinstance(result, dict) and "error" not in result:
        checks_passed += 1
    else:
        notes.append(f"Tool returned error or empty result: {result}")

    # ── 2. Args are not None/empty ─────────────────────────────────────────
    total_checks += 1
    if args and isinstance(args, dict) and len(args) > 0:
        checks_passed += 1
    else:
        notes.append("Tool called with empty or null arguments")

    # ── 3. Tool-specific argument validation ──────────────────────────────
    args_valid = True

    if tool_name == "extract_financial_metrics":
        total_checks += 1
        if "pdf_path" in args and "borrower_id" in args:
            checks_passed += 1
        else:
            notes.append("Missing pdf_path or borrower_id argument")
            args_valid = False

        # Check against ground truth if available
        if scenario_data and result and "total_debt" in result:
            gt = scenario_data.get("raw_financials", {})
            for field in ["total_debt", "reported_ebitda", "interest_expense"]:
                gt_val = gt.get(field)
                extracted_val = result.get(field)
                if gt_val and extracted_val:
                    total_checks += 1
                    deviation = abs(extracted_val - gt_val) / gt_val
                    if deviation <= 0.05:  # within 5%
                        checks_passed += 1
                    else:
                        notes.append(
                            f"{field}: extracted {extracted_val:,.0f} vs "
                            f"expected {gt_val:,.0f} ({deviation*100:.1f}% deviation)"
                        )

    elif tool_name == "identify_applicable_covenants":
        total_checks += 1
        borrower_id = args.get("borrower_id", "")
        if borrower_id in VALID_BORROWER_IDS or borrower_id.startswith("CORP-"):
            checks_passed += 1
        else:
            notes.append(f"Suspicious borrower_id argument: '{borrower_id}'")
            args_valid = False

        # Result should have covenants key
        total_checks += 1
        if result and "covenants" in result:
            checks_passed += 1
        else:
            notes.append("Result missing 'covenants' key")

    elif tool_name == "check_accounting_adjustments":
        total_checks += 1
        if "borrower_id" in args and "raw_financials" in args:
            checks_passed += 1
        else:
            notes.append("Missing borrower_id or raw_financials argument")
            args_valid = False

        # raw_financials should have numeric content, not be empty/hallucinated
        total_checks += 1
        raw_fin = args.get("raw_financials", {})
        if isinstance(raw_fin, dict) and raw_fin.get("reported_ebitda", 0) > 0:
            checks_passed += 1
        else:
            notes.append("raw_financials appears empty or zero — possible hallucination")

    elif tool_name == "check_grace_period":
        total_checks += 1
        if "borrower_id" in args:
            checks_passed += 1
        else:
            notes.append("Missing borrower_id argument")
            args_valid = False

    elif tool_name == "calculate_breach_risk":
        total_checks += 1
        required = ["adjusted_financials", "covenants", "grace_period_info"]
        if all(k in args for k in required):
            checks_passed += 1
        else:
            missing = [k for k in required if k not in args]
            notes.append(f"Missing arguments: {missing}")
            args_valid = False

        # Check verdict is a valid value
        total_checks += 1
        if result and result.get("verdict") in VALID_VERDICTS:
            checks_passed += 1
        else:
            notes.append(f"Invalid or missing verdict: {result.get('verdict') if result else 'no result'}")

    elif tool_name == "generate_report":
        total_checks += 1
        required = ["scenario_id", "borrower_id", "extraction_result",
                    "covenant_result", "adjustment_result",
                    "grace_period_result", "breach_result"]
        if all(k in args for k in required):
            checks_passed += 1
        else:
            missing = [k for k in required if k not in args]
            notes.append(f"Missing arguments: {missing}")
            args_valid = False

    accuracy_score = round(checks_passed / total_checks, 4) if total_checks > 0 else 0.0

    return {
        "tool_name": tool_name,
        "accuracy_score": accuracy_score,
        "args_valid": args_valid,
        "returned_result": bool(result and not isinstance(result, Exception)),
        "checks_passed": checks_passed,
        "total_checks": total_checks,
        "notes": notes if notes else ["All checks passed"],
    }
