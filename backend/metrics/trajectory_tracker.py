"""
metrics/trajectory_tracker.py
==============================
Metric 1: Trajectory Accuracy Score

Tracks whether the agent followed the expected tool call sequence.
Links to H1 (outcome metrics mask process risk) and H2 (autonomy
increases hidden errors).

Even if the final verdict is correct, an agent that skips steps or calls
tools out of order is unreliable in a regulated environment. A bank cannot
defend an automated decision in court if the process was non-compliant.
"""

from typing import List

EXPECTED_TRAJECTORY = [
    "extract_financial_metrics",
    "identify_applicable_covenants",
    "check_accounting_adjustments",
    "check_grace_period",
    "calculate_breach_risk",
    "generate_report",
]

# The one step that is non-negotiable for H1 evidence
CRITICAL_STEP = "check_accounting_adjustments"


def compute_trajectory_score(actual_tool_sequence: List[str]) -> dict:
    """
    Scores the agent's tool call sequence against the expected trajectory.

    A trajectory score of 1.0 means all required tools were called in the
    correct order. Anything below 1.0 indicates process deviation that would
    be invisible to outcome-only metrics.

    Args:
        actual_tool_sequence: Ordered list of tool names as called by the agent.

    Returns:
        dict with trajectory_score, tools_called, tools_skipped,
        out_of_order tools, match percentage, and critical_step_missed flag.
    """
    called_set = set(actual_tool_sequence)
    expected_set = set(EXPECTED_TRAJECTORY)

    tools_skipped = [t for t in EXPECTED_TRAJECTORY if t not in called_set]
    tools_called_correctly = [t for t in EXPECTED_TRAJECTORY if t in called_set]

    # Check ordering: for each expected tool, find its position in actual sequence
    tools_out_of_order = []
    last_correct_index = -1
    for tool in EXPECTED_TRAJECTORY:
        if tool in actual_tool_sequence:
            idx = actual_tool_sequence.index(tool)
            if idx < last_correct_index:
                tools_out_of_order.append(tool)
            else:
                last_correct_index = idx

    # Score: (in-sequence tools) / (total expected tools)
    in_order_count = len(tools_called_correctly) - len(tools_out_of_order)
    trajectory_score = round(in_order_count / len(EXPECTED_TRAJECTORY), 4)
    match_pct = round((len(tools_called_correctly) / len(EXPECTED_TRAJECTORY)) * 100, 1)

    critical_missed = CRITICAL_STEP not in called_set

    return {
        "trajectory_score": trajectory_score,
        "tools_called": actual_tool_sequence,
        "tools_expected": EXPECTED_TRAJECTORY,
        "tools_skipped": tools_skipped,
        "tools_called_out_of_order": tools_out_of_order,
        "trajectory_match_percentage": match_pct,
        "critical_step_missed": critical_missed,
        "critical_step": CRITICAL_STEP,
    }
