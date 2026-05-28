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

os.environ.setdefault("LITELLM_LOCAL_MODEL_COST_MAP", "True")

from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm
from google.genai import types as genai_types

from agent.tools import (
    extract_financial_metrics,
    identify_applicable_covenants,
    check_accounting_adjustments,
    check_grace_period,
    calculate_breach_risk,
    generate_report,
)

TOOL_NAMES = (
    "extract_financial_metrics, identify_applicable_covenants, "
    "check_accounting_adjustments, check_grace_period, "
    "calculate_breach_risk, generate_report"
)

LEVEL_1_INSTRUCTION = f"""
Use only these tools: {TOOL_NAMES}.
Run them in this exact order:
1. extract_financial_metrics(pdf_path, borrower_id)
2. identify_applicable_covenants(borrower_id)
3. check_accounting_adjustments(borrower_id, raw_financials=step1)
4. check_grace_period(borrower_id)
5. calculate_breach_risk(adjusted_financials=step3+step1, covenants=step2, grace_period_info=step4)
6. generate_report(scenario_id, borrower_id, step1, step2, step3, step4, step5)
Return only step 6. No extra text.
"""

LEVEL_2_INSTRUCTION = f"""
Use only these tools: {TOOL_NAMES}.
Check adjustments and grace period before calculate_breach_risk.
Return the final report only.
"""

LEVEL_3_INSTRUCTION = f"""
Use only these tools: {TOOL_NAMES}.
Prefer the full 6-step sequence. Return the final report only.
"""


def create_covenant_agent(
    autonomy_level: int = 1,
    ollama_model: str | None = None,
    *,
    before_tool_callback=None,
    after_tool_callback=None,
    on_tool_error_callback=None,
) -> Agent:
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
    ollama_model: Optional Ollama model string like 'llama3.1:8b'.

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
    model_name = (ollama_model or os.getenv("OLLAMA_MODEL", "llama3.1:8b")).removeprefix("ollama/")

    os.environ.setdefault("OLLAMA_API_BASE", ollama_host)

    model = LiteLlm(
        model=f"ollama/{model_name}",
    )

    agent = Agent(
        name=f"risk_eval_l{autonomy_level}",
        model=model,
        instruction=instruction,
        generate_content_config=genai_types.GenerateContentConfig(
            temperature=0,
        ),
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
        before_tool_callback=before_tool_callback,
        after_tool_callback=after_tool_callback,
        on_tool_error_callback=on_tool_error_callback,
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
