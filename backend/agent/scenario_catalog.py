"""
scenario_catalog.py
===================
Builds run scenarios directly from the synthetic PDF reports.

This is the live source of truth for the workflow: each scenario is derived
from a PDF filename plus the PDF contents, not from static JSON fixtures.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from agent.tools.adjustment_checker import check_accounting_adjustments
from agent.tools.breach_calculator import calculate_breach_risk
from agent.tools.covenant_identifier import identify_applicable_covenants
from agent.tools.grace_period_checker import check_grace_period
from agent.tools.pdf_extractor import extract_financial_metrics
from agent.tools.report_generator import generate_report

PDFS_PATH = Path(__file__).parent.parent / "data" / "synthetic_pdfs"
BORROWER_PROFILES_PATH = Path(__file__).parent.parent / "data" / "borrower_profiles.json"
PDF_PATTERN = re.compile(
    r"^(?P<borrower_id>[A-Z0-9-]+)_(?P<year>\d{4})_(?P<quarter>Q[1-4])_Financial_Report\.pdf$"
)


def _load_borrowers() -> dict[str, dict[str, Any]]:
    import json

    if not BORROWER_PROFILES_PATH.exists():
        return {}
    with open(BORROWER_PROFILES_PATH) as f:
        data = json.load(f)
    return {b["borrower_id"]: b for b in data.get("borrowers", [])}


def _parse_pdf_metadata(pdf_path: Path) -> dict[str, Any] | None:
    match = PDF_PATTERN.match(pdf_path.name)
    if not match:
        return None
    return match.groupdict()


def build_pdf_scenario(pdf_path: Path) -> dict[str, Any]:
    metadata = _parse_pdf_metadata(pdf_path)
    if not metadata:
        return {"error": f"Unrecognized PDF filename: {pdf_path.name}", "pdf_path": str(pdf_path)}

    borrower_id = metadata["borrower_id"]
    borrowers = _load_borrowers()
    borrower = borrowers.get(borrower_id, {})
    scenario_id = pdf_path.stem

    extracted = extract_financial_metrics(str(pdf_path), borrower_id)
    covenants = identify_applicable_covenants(borrower_id)
    adjustments = check_accounting_adjustments(borrower_id, extracted)
    grace_period = check_grace_period(borrower_id)
    adjusted_financials = {
        "adjusted_ebitda": adjustments.get("adjusted_ebitda", extracted.get("reported_ebitda", 0)),
        "adjusted_debt": adjustments.get("adjusted_debt", extracted.get("total_debt", 0)),
        "interest_expense": extracted.get("interest_expense", 0),
        "current_assets": extracted.get("current_assets", 0),
        "current_liabilities": extracted.get("current_liabilities", 0),
    }
    breach_result = calculate_breach_risk(adjusted_financials, covenants, grace_period)
    report = generate_report(
        scenario_id,
        borrower_id,
        extracted,
        covenants,
        adjustments,
        grace_period,
        breach_result,
    )

    return {
        "scenario_id": scenario_id,
        "pdf_filename": pdf_path.name,
        "pdf_path": str(pdf_path),
        "borrower_id": borrower_id,
        "borrower_name": borrower.get("name", borrower_id),
        "quarter": metadata["quarter"],
        "year": int(metadata["year"]),
        "expected_verdict": breach_result.get("verdict", "unknown"),
        "raw_financials": extracted,
        "covenants": covenants.get("covenants", {}),
        "adjustments": adjustments,
        "grace_period_info": grace_period,
        "adjusted_financials": adjusted_financials,
        "breach_result": breach_result,
        "report": report,
        "input_summary": {
            "reported_ebitda": extracted.get("reported_ebitda", 0),
            "total_debt": extracted.get("total_debt", 0),
            "interest_expense": extracted.get("interest_expense", 0),
            "current_assets": extracted.get("current_assets", 0),
            "current_liabilities": extracted.get("current_liabilities", 0),
            "adjustment_items": extracted.get("adjustment_items", {}),
        },
        "reasoning": report.get("audit_summary"),
    }


def list_pdf_scenarios() -> list[dict[str, Any]]:
    if not PDFS_PATH.exists():
        return []
    scenarios = []
    for pdf_path in sorted(PDFS_PATH.glob("*.pdf")):
        scenario = build_pdf_scenario(pdf_path)
        if "error" not in scenario:
            scenarios.append(scenario)
    return scenarios


def get_pdf_scenario(scenario_id: str) -> dict[str, Any] | None:
    for scenario in list_pdf_scenarios():
        if scenario["scenario_id"] == scenario_id:
            return scenario
    return None
