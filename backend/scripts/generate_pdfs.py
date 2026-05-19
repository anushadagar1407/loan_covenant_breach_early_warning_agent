"""
scripts/generate_pdfs.py
=========================
Generates 10 realistic synthetic loan financial report PDFs.

Key design choice: adjustment items (restructuring charges, decommissioning costs,
legal costs) are BURIED in the Notes section as prose — NOT in the main financial
table. This mirrors real-world filings where these items require careful reading.

An agent that only reads the Financial Highlights table will MISS the adjustment
items — which is exactly the process error H1 captures.

Run: python scripts/generate_pdfs.py
"""

import json
from pathlib import Path
from datetime import date

try:
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph,
        Spacer, PageBreak,
    )
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    REPORTLAB_OK = True
except ImportError:
    REPORTLAB_OK = False
    print("reportlab not installed. Run: pip install reportlab")

DB_BLUE = colors.HexColor("#003882")
DB_LIGHT = colors.HexColor("#E8EFF8")

OUTPUT_DIR = Path(__file__).parent.parent / "data" / "synthetic_pdfs"
GT_PATH = Path(__file__).parent.parent / "data" / "ground_truth.json"
BP_PATH = Path(__file__).parent.parent / "data" / "borrower_profiles.json"

PERIOD_MAP = {
    "Q3_2024": "Third Quarter 2024 (Period ended 30 September 2024)",
    "Q4_2024": "Fourth Quarter 2024 (Period ended 31 December 2024)",
}


def _fmt_eur(val: float) -> str:
    """Format a number as EUR millions."""
    millions = val / 1_000_000
    return f"EUR {millions:,.1f}M"


def generate_pdf(scenario: dict, borrower: dict):
    if not REPORTLAB_OK:
        print("Skipping PDF generation — reportlab not available")
        return

    # ✅ use scenario, NOT scen
    borrower_id = scenario["borrower_id"]
    year = scenario["year"]          # e.g. 2026
    quarter = scenario["quarter"]    # e.g. "Q1"

    filename = f"{borrower_id}_{year}_{quarter}_Financial_Report.pdf"
    output_path = OUTPUT_DIR / filename

    raw = {
        "total_debt": scenario["total_debt"],
        "reported_ebitda": scenario["reported_ebitda"],
        "interest_expense": scenario["interest_expense"],
        "current_assets": scenario["current_assets"],
        "current_liabilities": scenario["current_liabilities"],
        "restructuring_charges": scenario.get("restructuring_charges", 0),
        "decommissioning_costs": scenario.get("decommissioning_costs", 0),
        "exceptional_legal_costs": scenario.get("exceptional_legal_costs", 0),
    }

    period_code = f"{quarter}_{year}"  # e.g. "Q1_2026"
    period_label = PERIOD_MAP.get(period_code, f"{quarter} {year}")

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2.5*cm,
        bottomMargin=2*cm,
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "Title", parent=styles["Heading1"],
        fontSize=18, textColor=DB_BLUE, alignment=TA_CENTER, spaceAfter=6
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", parent=styles["Normal"],
        fontSize=11, textColor=colors.grey, alignment=TA_CENTER, spaceAfter=4
    )
    confidential_style = ParagraphStyle(
        "Confidential", parent=styles["Normal"],
        fontSize=10, textColor=colors.red, alignment=TA_CENTER, spaceAfter=20
    )
    h2_style = ParagraphStyle(
        "H2", parent=styles["Heading2"],
        fontSize=13, textColor=DB_BLUE, spaceBefore=16, spaceAfter=6
    )
    body_style = ParagraphStyle(
        "Body", parent=styles["Normal"],
        fontSize=10, leading=14, spaceAfter=8
    )

    story = []

    # ── Cover page ────────────────────────────────────────────────────────
    story.append(Spacer(1, 3*cm))
    story.append(Paragraph(borrower["name"], title_style))
    story.append(Paragraph("Financial Report", subtitle_style))
    story.append(Paragraph(period_label, subtitle_style))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("CONFIDENTIAL — FOR BANK USE ONLY", confidential_style))
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph(f"Borrower ID: {borrower['borrower_id']}", body_style))
    story.append(Paragraph(f"Report Date: {date.today().strftime('%d %B %Y')}", body_style))
    story.append(PageBreak())

    # ── Executive Summary ─────────────────────────────────────────────────
    story.append(Paragraph("1. Executive Summary", h2_style))
    verdict = scenario.get("correct_verdict", scenario["expected_verdict"])
    if verdict == "no_breach":
        exec_text = (
            f"{borrower['name']} has delivered a stable financial performance for {period_label}. "
            f"Revenue growth has been supported by operational improvements and cost discipline. "
            f"The company remains within all covenant parameters and management is confident "
            f"in maintaining compliance through the remainder of the financial year."
        )
    elif verdict == "breach":
        exec_text = (
            f"{borrower['name']} has experienced a challenging period, with elevated debt levels "
            f"and increased financing costs weighing on financial metrics. "
            f"Management is actively implementing a deleveraging programme and is in dialogue "
            f"with its banking syndicate regarding the financial position."
        )
    else:  # imminent
        exec_text = (
            f"{borrower['name']} reports continued operational performance, though the financial "
            f"leverage position has tightened over recent quarters. Management has identified "
            f"this trend and has initiated preliminary discussions with its relationship banks. "
            f"Covenant headroom has reduced and will require monitoring."
        )
    story.append(Paragraph(exec_text, body_style))

    # ── Financial Highlights Table ────────────────────────────────────────
    story.append(Paragraph("2. Financial Highlights", h2_style))

    # Build prior period (simplified: 10% better than current)
    def prior(val): return val * 0.9

    table_data = [
        ["Metric", "Current Period", "Prior Period", "Covenant Threshold"],
        ["Total Debt", _fmt_eur(raw["total_debt"]), _fmt_eur(prior(raw["total_debt"])), "—"],
        ["Reported EBITDA", _fmt_eur(raw["reported_ebitda"]), _fmt_eur(prior(raw["reported_ebitda"])), "—"],
        ["Interest Expense", _fmt_eur(raw["interest_expense"]), _fmt_eur(prior(raw["interest_expense"])), "—"],
        ["Current Assets", _fmt_eur(raw["current_assets"]), _fmt_eur(prior(raw["current_assets"])), "—"],
        ["Current Liabilities", _fmt_eur(raw["current_liabilities"]), _fmt_eur(prior(raw["current_liabilities"])), "—"],
    ]

    # Add covenant thresholds
    cv = borrower["covenants"]
    table_data[1][3] = f"Max Debt/EBITDA: {cv['max_debt_to_ebitda']}x"
    table_data[2][3] = f"Min Coverage: {cv['min_interest_coverage']}x"
    table_data[5][3] = f"Min Liquidity: {cv['min_liquidity_ratio']}x"

    tbl = Table(table_data, colWidths=[5.5*cm, 3.5*cm, 3.5*cm, 5.5*cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DB_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, DB_LIGHT]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(tbl)

    # ── Notes to Financial Statements (ADJUSTMENT ITEMS BURIED HERE) ─────
    story.append(Paragraph("3. Notes to Financial Statements", h2_style))

    notes_text = (
        "The financial statements have been prepared in accordance with IFRS as adopted by the European Union. "
        "All figures are in Euro millions unless otherwise stated. "
        "Comparative figures relate to the equivalent prior period."
    )
    story.append(Paragraph(notes_text, body_style))

    # Bury adjustment items in prose
    restructuring = raw.get("restructuring_charges", 0)
    decommissioning = raw.get("decommissioning_costs", 0)
    legal_costs = raw.get("exceptional_legal_costs", 0)

    if restructuring > 0:
        story.append(Paragraph(
            f"During the period, the Group incurred non-recurring restructuring charges of "
            f"EUR {restructuring/1e6:.1f}M relating to the consolidation of manufacturing "
            f"facilities and associated workforce reorganisation. These charges are considered "
            f"non-recurring in nature. Under Schedule 4 of the Facility Agreement, restructuring "
            f"charges may be treated as an EBITDA add-back for covenant testing purposes, "
            f"subject to a cap of 15% of Reported EBITDA.",
            body_style
        ))

    if decommissioning > 0:
        story.append(Paragraph(
            f"The Group recognised decommissioning costs of EUR {decommissioning/1e6:.1f}M "
            f"in the current period, primarily related to the retirement of legacy energy "
            f"generation assets. Pursuant to Schedule 7 of the Facility Agreement, decommissioning "
            f"costs up to EUR 5.0M per annum may be added back to EBITDA for the purposes of "
            f"computing the Leverage Ratio covenant.",
            body_style
        ))

    if legal_costs > 0:
        story.append(Paragraph(
            f"Exceptional legal costs of EUR {legal_costs/1e6:.1f}M were incurred in Q2 and Q3 "
            f"in connection with legacy litigation proceedings. Under the terms of the Facility "
            f"Agreement, up to EUR 2.0M of exceptional legal costs may be excluded from the "
            f"debt calculation for the purposes of covenant testing during Q2 and Q3 reporting "
            f"periods only.",
            body_style
        ))

    if not any([restructuring, decommissioning, legal_costs]):
        story.append(Paragraph(
            "There are no non-recurring or exceptional items requiring separate disclosure "
            "in the current reporting period. The Group has not utilised any permitted "
            "accounting adjustments under the Facility Agreement for the current period.",
            body_style
        ))

    # ── Management Commentary ─────────────────────────────────────────────
    story.append(Paragraph("4. Management Commentary", h2_style))

    if verdict == "no_breach":
        commentary = (
            f"Management confirms compliance with all financial covenants as at the reporting date. "
            f"The outlook for the remainder of the financial year remains positive, "
            f"with operational improvements expected to support EBITDA growth. "
            f"The company maintains sufficient liquidity headroom across all facilities."
        )
    elif verdict == "breach":
        commentary = (
            f"Management acknowledges the financial covenant challenges in the current period. "
            f"A deleveraging plan has been prepared and will be presented to the banking syndicate. "
            f"Management is committed to restoring compliance within the agreed timelines "
            f"and maintaining open and transparent dialogue with its lenders."
        )
    else:
        commentary = (
            f"Management notes the reduction in covenant headroom during the period. "
            f"A detailed financial review is underway and management expects to present "
            f"an updated financial plan in the next quarter. "
            f"The company maintains a constructive dialogue with its relationship banks."
        )
    story.append(Paragraph(commentary, body_style))

    doc.build(story)
    print(f"Generated: {output_path}")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with open(GT_PATH) as f:
        gt = json.load(f)
    with open(BP_PATH) as f:
        bp = json.load(f)

    borrowers = {b["borrower_id"]: b for b in bp["borrowers"]}

    for scenario in gt["scenarios"]:
        borrower = borrowers[scenario["borrower_id"]]
        generate_pdf(scenario, borrower)

    print(f"\nAll PDFs written to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
