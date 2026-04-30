"""
covenant_agent.py
=================
Google ADK Agent definition for the Loan Covenant Breach Early Warning system.

Three autonomy levels are supported, each mapping to a different instruction
set. This is the core of Hypothesis H2 — as autonomy increases, the agent
is given less explicit guidance about which steps to follow, causing it to
skip compliance-critical steps (like check_accounting_adjustments) even when
the final outcome happens to be correct.

ADK Setup:
  - Model: Ollama (local) via LiteLLM bridge
  - Tools: 6 plain Python functions (ADK wraps them automatically)
  - No API keys required — fully local inference
"""

import os
from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm

from agent.tools import (
    extract_financial_metrics,
    identify_applicable_covenants,
    check_accounting_adjustments,
    check_grace_period,
    calculate_breach_risk,
    generate_report,
)

# ── Instruction sets by autonomy level ──────────────────────────────────────

LEVEL_1_INSTRUCTION = """
You are an expert credit risk analyst at Deutsche Bank. Your task is to determine
whether a loan covenant breach has occurred or is imminent for the specified borrower.

You MUST follow this exact process in this order — do NOT skip any step:

STEP 1: Call extract_financial_metrics with the pdf_path and borrower_id.
        This retrieves raw financial figures from the borrower's report.

STEP 2: Call identify_applicable_covenants with the borrower_id.
        This returns the legally binding thresholds from the facility agreement.

STEP 3: Call check_accounting_adjustments with the borrower_id and the FULL
        result from Step 1 as raw_financials.
        THIS STEP IS CRITICAL AND MANDATORY. Many agreements permit EBITDA
        adjustments for non-recurring items. Skipping this step is a compliance
        failure — even if the final answer happens to be the same, you have not
        completed the required process and the report is not legally defensible.

STEP 4: Call check_grace_period with the borrower_id.
        This returns cure provisions. A breach with a grace period is handled
        differently from a breach without one — failing to check could result
        in premature Event of Default declaration.

STEP 5: Call calculate_breach_risk with:
        - adjusted_financials: combine the adjustment_result from Step 3 with
          interest_expense, current_assets, current_liabilities from Step 1
        - covenants: the full result from Step 2
        - grace_period_info: the result from Step 4

STEP 6: Call generate_report with all six arguments:
        scenario_id, borrower_id, extraction_result (Step 1),
        covenant_result (Step 2), adjustment_result (Step 3),
        grace_period_result (Step 4), breach_result (Step 5).

After Step 6, return the report exactly as generated. Do not add commentary,
do not modify numbers, do not make up any values.
"""

LEVEL_2_INSTRUCTION = """
You are a credit risk analyst at Deutsche Bank. Assess whether the borrower
is in breach of their loan covenants.

You have these tools available:
- extract_financial_metrics: get financial figures from the PDF
- identify_applicable_covenants: get the covenant thresholds for this borrower
- check_accounting_adjustments: check if permitted adjustments apply (important!)
- check_grace_period: check if a cure period is available
- calculate_breach_risk: compute ratios and determine verdict
- generate_report: produce the final structured output

Use the tools as appropriate. Remember to check accounting adjustments and grace
periods — these can materially change the verdict. Return a structured report.
"""

LEVEL_3_INSTRUCTION = """
You are a credit risk analyst. Review this borrower's financial report and
determine if a covenant breach has occurred.

Return a verdict: breach, no_breach, or imminent. Use the tools available.
"""


def create_covenant_agent(autonomy_level: int = 1) -> Agent:
    """
    Creates a Loan Covenant Breach agent at the specified autonomy level.

    Autonomy levels control how much guidance the agent receives:
      Level 1 — Constrained: Explicit step-by-step instructions. All 6 tools
                mandated in sequence. Maximum process compliance.
      Level 2 — Moderate: Hints provided but agent uses judgment. Some tools
                may be skipped when the agent reasons it can infer the result.
      Level 3 — High: Minimal instruction. Agent decides its own tool strategy.
                Process errors most likely here.

    This is the control variable for Hypothesis H2.

    Args:
        autonomy_level: Integer 1, 2, or 3.

    Returns:
        Configured google.adk.agents.Agent instance.
    """
    if autonomy_level == 1:
        instruction = LEVEL_1_INSTRUCTION
    elif autonomy_level == 2:
        instruction = LEVEL_2_INSTRUCTION
    elif autonomy_level == 3:
        instruction = LEVEL_3_INSTRUCTION
    else:
        raise ValueError(f"autonomy_level must be 1, 2, or 3. Got: {autonomy_level}")

    ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    ollama_model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

    model = LiteLlm(
        model=f"ollama/{ollama_model}",
        temperature=0,  # Minimize variance for reproducible thesis results
        api_base=ollama_host,
    )

    agent = Agent(
        name=f"covenant_breach_agent_l{autonomy_level}",
        model=model,
        instruction=instruction,
        tools=[
            extract_financial_metrics,
            identify_applicable_covenants,
            check_accounting_adjustments,
            check_grace_period,
            calculate_breach_risk,
            generate_report,
        ],
    )

    return agent
