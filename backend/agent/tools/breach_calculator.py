"""
Tool: calculate_breach_risk
Computes all three covenant ratios from adjusted financials and
determines the breach verdict. This is the final computation step
before report generation.
"""


def calculate_breach_risk(
    adjusted_financials: dict,
    covenants: dict,
    grace_period_info: dict,
) -> dict:
    """
    Computes covenant ratios from adjusted financial figures and determines
    whether a breach has occurred, is imminent, or the borrower is compliant.

    This tool must receive ADJUSTED financials (from check_accounting_adjustments),
    not raw reported figures. Using raw figures when adjustments apply constitutes
    a process error — the ratio will be incorrect and the verdict may be wrong.

    Verdict logic:
    - 'no_breach': All three covenants satisfied
    - 'imminent': Any ratio within 5% of its breach threshold
    - 'breach': Any threshold violated
    - 'breach_curable': Breach confirmed but a grace period is available

    Args:
        adjusted_financials: Dict with adjusted_ebitda, adjusted_debt,
            interest_expense, current_assets, current_liabilities.
        covenants: Dict with max_debt_to_ebitda, min_interest_coverage,
            min_liquidity_ratio (from identify_applicable_covenants).
        grace_period_info: Dict from check_grace_period.

    Returns:
        dict with computed ratios, per-covenant status, verdict, severity
        score, and human-readable risk flags.
    """
    # --- Extract values safely ---
    adjusted_ebitda = float(adjusted_financials.get("adjusted_ebitda", 0))
    adjusted_debt = float(adjusted_financials.get("adjusted_debt", 0))

    # interest_expense may come directly from the extraction result
    interest_expense = float(
        adjusted_financials.get("interest_expense") or
        adjusted_financials.get("raw_interest_expense") or 0
    )
    current_assets = float(adjusted_financials.get("current_assets", 0))
    current_liabilities = float(adjusted_financials.get("current_liabilities", 0))

    # Covenant thresholds
    cv = covenants.get("covenants", covenants)  # handle nested or flat
    max_leverage = float(cv.get("max_debt_to_ebitda", 999))
    min_coverage = float(cv.get("min_interest_coverage", 0))
    min_liquidity = float(cv.get("min_liquidity_ratio", 0))

    # --- Compute ratios (guard against division by zero) ---
    debt_to_ebitda = (adjusted_debt / adjusted_ebitda) if adjusted_ebitda > 0 else 999.0
    interest_coverage = (adjusted_ebitda / interest_expense) if interest_expense > 0 else 999.0
    liquidity_ratio = (current_assets / current_liabilities) if current_liabilities > 0 else 999.0

    # --- Per-covenant pass/breach ---
    leverage_status = "breach" if debt_to_ebitda > max_leverage else "pass"
    coverage_status = "breach" if interest_coverage < min_coverage else "pass"
    liquidity_status = "breach" if liquidity_ratio < min_liquidity else "pass"

    any_breach = any(s == "breach" for s in [leverage_status, coverage_status, liquidity_status])

    # --- Imminence check: within 2% of threshold ---
    leverage_imminent = (
        not any_breach and
        max_leverage < 999 and
        debt_to_ebitda > max_leverage * 0.98
    )
    coverage_imminent = (
        not any_breach and
        min_coverage > 0 and
        interest_coverage < min_coverage * 1.02
    )
    liquidity_imminent = (
        not any_breach and
        min_liquidity > 0 and
        liquidity_ratio < min_liquidity * 1.02
    )
    any_imminent = any([leverage_imminent, coverage_imminent, liquidity_imminent])

    # --- Verdict ---
    # A breach is only curable if the grace period covers the SPECIFIC covenant that's breached.
    cure_leverage = grace_period_info.get("cure_applies_to_leverage", grace_period_info.get("cure_available", False))
    cure_coverage = grace_period_info.get("cure_applies_to_coverage", grace_period_info.get("cure_available", False))
    cure_liquidity = grace_period_info.get("cure_applies_to_liquidity", grace_period_info.get("cure_available", False))

    breach_is_curable = (
        (leverage_status == "breach" and cure_leverage) or
        (coverage_status == "breach" and cure_coverage) or
        (liquidity_status == "breach" and cure_liquidity)
    ) and not (
        # Not curable if any breached covenant lacks cure coverage
        (leverage_status == "breach" and not cure_leverage) or
        (coverage_status == "breach" and not cure_coverage) or
        (liquidity_status == "breach" and not cure_liquidity)
    )

    if any_breach and breach_is_curable:
        verdict = "breach_curable"
    elif any_breach:
        verdict = "breach"
    elif any_imminent:
        verdict = "imminent"
    else:
        verdict = "no_breach"

    # --- Breach severity score (0.0 = clean, 1.0 = severe) ---
    severity_scores = []
    if max_leverage < 999 and adjusted_ebitda > 0:
        severity_scores.append(max(0.0, (debt_to_ebitda - max_leverage) / max_leverage))
    if min_coverage > 0 and interest_expense > 0:
        severity_scores.append(max(0.0, (min_coverage - interest_coverage) / min_coverage))
    if min_liquidity > 0 and current_liabilities > 0:
        severity_scores.append(max(0.0, (min_liquidity - liquidity_ratio) / min_liquidity))

    breach_severity_score = round(max(severity_scores) if severity_scores else 0.0, 4)

    # --- Risk flags (human-readable) ---
    risk_flags = []
    if leverage_status == "breach":
        risk_flags.append(
            f"LEVERAGE BREACH: Debt/EBITDA {debt_to_ebitda:.2f}x exceeds threshold {max_leverage:.1f}x"
        )
    elif leverage_imminent:
        risk_flags.append(
            f"LEVERAGE IMMINENT: Debt/EBITDA {debt_to_ebitda:.2f}x approaching threshold {max_leverage:.1f}x"
        )
    if coverage_status == "breach":
        risk_flags.append(
            f"COVERAGE BREACH: Interest coverage {interest_coverage:.2f}x below minimum {min_coverage:.1f}x"
        )
    elif coverage_imminent:
        risk_flags.append(
            f"COVERAGE IMMINENT: Interest coverage {interest_coverage:.2f}x near minimum {min_coverage:.1f}x"
        )
    if liquidity_status == "breach":
        risk_flags.append(
            f"LIQUIDITY BREACH: Liquidity ratio {liquidity_ratio:.2f}x below minimum {min_liquidity:.1f}x"
        )
    elif liquidity_imminent:
        risk_flags.append(
            f"LIQUIDITY IMMINENT: Liquidity ratio {liquidity_ratio:.2f}x near minimum {min_liquidity:.1f}x"
        )
    if breach_is_curable and any_breach:
        risk_flags.append(
            f"CURE AVAILABLE: {grace_period_info.get('grace_period_days')} business days to cure"
        )

    return {
        "debt_to_ebitda": round(debt_to_ebitda, 4),
        "interest_coverage": round(interest_coverage, 4),
        "liquidity_ratio": round(liquidity_ratio, 4),
        "covenant_status": {
            "leverage": leverage_status,
            "coverage": coverage_status,
            "liquidity": liquidity_status,
        },
        "verdict": verdict,
        "breach_severity_score": breach_severity_score,
        "risk_flags": risk_flags,
    }
