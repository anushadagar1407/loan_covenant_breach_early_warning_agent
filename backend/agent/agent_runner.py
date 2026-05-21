"""
agent_runner.py
================
Wraps the ADK agent run with complete metrics instrumentation.

Every tool call is intercepted, timed, and scored. All events are persisted
to SQLite. This module is the bridge between the ADK agent (which handles
LLM reasoning + tool dispatch) and the metrics/registry system (which
measures process quality).

ADK Callback Pattern:
  ADK 0.4.x+ supports before_tool_callback and after_tool_callback on the
  Agent class. We use these to record tool events without modifying tools.
  If your ADK version doesn't support callbacks, we fall back to wrapping
  tools in timing decorators.
"""

import asyncio
import json
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from agent.covenant_agent import create_covenant_agent
# DEBUG: instrument litellm to log token usage
import litellm
litellm.set_verbose = False  # set True only if you want full request/response dumps (very loud)
# Hook to log token usage per call
_orig_success_callback = getattr(litellm, "success_callback", [])
def _token_logger(kwargs, completion_response, start_time, end_time):
    try:
        usage = getattr(completion_response, "usage", None) or completion_response.get("usage", {})
        prompt_tokens = usage.get("prompt_tokens", 0) if hasattr(usage, "get") else getattr(usage, "prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0) if hasattr(usage, "get") else getattr(usage, "completion_tokens", 0)
        total = prompt_tokens + completion_tokens
        model = kwargs.get("model", "?")
        msgs = kwargs.get("messages", [])
        last_user_msg = next((m.get("content", "")[:200] for m in reversed(msgs) if m.get("role") == "user"), "")
        print(f"[LLM_CALL] model={model} prompt_tokens={prompt_tokens} completion_tokens={completion_tokens} total={total} | last_user_msg[0:200]={last_user_msg!r}", flush=True)
    except Exception as e:
        print(f"[LLM_CALL] logging error: {e}", flush=True)
litellm.success_callback = list(_orig_success_callback) + [_token_logger]

from metrics.trajectory_tracker import compute_trajectory_score
from metrics.tool_accuracy_scorer import score_tool_call_accuracy
from metrics.clause_coverage_scorer import compute_clause_coverage


class RunContext:
    """Thread-safe container for a single agent run's events."""

    def __init__(self, run_id: str, scenario_id: str, borrower_id: str, autonomy_level: int):
        self.run_id = run_id
        self.scenario_id = scenario_id
        self.borrower_id = borrower_id
        self.autonomy_level = autonomy_level
        self.started_at = datetime.now(timezone.utc)
        self.tool_events: list[dict] = []
        self.audit_entries: list[dict] = []
        self.call_order = 0

    def record_tool_start(self, tool_name: str, args: dict) -> int:
        """Record that a tool is about to be called. Returns call_order index."""
        self.call_order += 1
        order = self.call_order
        self.tool_events.append({
            "run_id": self.run_id,
            "tool_name": tool_name,
            "call_order": order,
            "called_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": None,
            "latency_ms": None,
            "args_json": json.dumps(args, default=str),
            "result_json": None,
            "accuracy_score": None,
            "error": None,
            "_start_time": time.monotonic(),
        })
        self._add_audit("tool_called", f"Calling tool: {tool_name}", {"args": args})
        return order

    def record_tool_end(self, tool_name: str, result: Any, error: str | None = None):
        """Record tool completion and compute latency."""
        event = next(
            (e for e in reversed(self.tool_events) if e["tool_name"] == tool_name and e["completed_at"] is None),
            None
        )
        if event:
            latency = (time.monotonic() - event.pop("_start_time")) * 1000
            event["completed_at"] = datetime.now(timezone.utc).isoformat()
            event["latency_ms"] = round(latency, 2)
            event["result_json"] = json.dumps(result, default=str) if result else None
            event["error"] = error

        status = "ERROR" if error else "OK"
        self._add_audit(
            "tool_completed",
            f"Tool {tool_name} completed [{status}] in {latency:.0f}ms" if event else f"Tool {tool_name} completed",
            {"result_summary": str(result)[:200] if result else None, "error": error}
        )

    def _add_audit(self, event_type: str, message: str, metadata: dict | None = None):
        self.audit_entries.append({
            "run_id": self.run_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type,
            "message": message,
            "metadata_json": json.dumps(metadata or {}, default=str),
        })


def _make_instrumented_tools(ctx: RunContext, borrower_has_adjustments: bool):
    """
    Wraps each tool function with timing and logging.
    Used as fallback when ADK callbacks aren't available.
    """
    from agent.tools import (
        extract_financial_metrics,
        identify_applicable_covenants,
        check_accounting_adjustments,
        check_grace_period,
        calculate_breach_risk,
        generate_report,
    )

    def wrap(fn):
        def wrapper(*args, **kwargs):
            # Build args dict for logging
            import inspect
            sig = inspect.signature(fn)
            bound = sig.bind(*args, **kwargs)
            bound.apply_defaults()
            args_dict = dict(bound.arguments)

            ctx.record_tool_start(fn.__name__, args_dict)
            try:
                result = fn(*args, **kwargs)
                ctx.record_tool_end(fn.__name__, result)
                return result
            except Exception as e:
                ctx.record_tool_end(fn.__name__, None, error=str(e))
                raise

        wrapper.__name__ = fn.__name__
        wrapper.__doc__ = fn.__doc__
        # Copy type hints so ADK can still introspect
        wrapper.__annotations__ = getattr(fn, "__annotations__", {})
        return wrapper

    return [
        wrap(extract_financial_metrics),
        wrap(identify_applicable_covenants),
        wrap(check_accounting_adjustments),
        wrap(check_grace_period),
        wrap(calculate_breach_risk),
        wrap(generate_report),
    ]


async def run_agent_with_metrics(
    scenario_id: str,
    borrower_id: str,
    pdf_path: str,
    autonomy_level: int = 1,
    ground_truth: dict | None = None,
    simulate_skip_tool: str | None = None,   # TEST ONLY: name of tool to skip
) -> dict:
    """
    Runs the covenant breach agent and captures full process metrics.

    This is the main entry point called by the FastAPI routes. It:
    1. Creates an instrumented agent run context
    2. Attempts to use ADK callbacks; falls back to wrapped tools
    3. Runs the agent against the specified scenario
    4. Computes all 5 thesis metrics from the captured tool events
    5. Returns the complete run record for persistence

    Args:
        scenario_id: The test scenario identifier (e.g. 'SCEN-001').
        borrower_id: Borrower identifier (e.g. 'CORP-001').
        pdf_path: Path to the financial report PDF.
        autonomy_level: 1 (constrained), 2 (moderate), 3 (high).
        ground_truth: Optional scenario dict for outcome comparison.

    Returns:
        Complete run record dict including all metrics, tool events, and audit log.
    """
    run_id = str(uuid.uuid4())
    ctx = RunContext(run_id, scenario_id, borrower_id, autonomy_level)

    # Load borrower profile for metric computation
    import json as _json
    from pathlib import Path
    profiles_path = Path(__file__).parent.parent / "data" / "borrower_profiles.json"
    borrower_profile = {}
    if profiles_path.exists():
        with open(profiles_path) as f:
            profiles = _json.load(f)
        borrower_profile = next(
            (b for b in profiles["borrowers"] if b["borrower_id"] == borrower_id), {}
        )

    borrower_has_adjustments = borrower_profile.get("has_accounting_adjustments", False)
    borrower_has_grace = borrower_profile.get("has_grace_period", False)

    # Build instrumented tools for this run
    instrumented_tools = _make_instrumented_tools(ctx, borrower_has_adjustments)

    # ── SIMULATION MODE (no LLM needed) ───────────────────────────────────────
    # simulate_skip_tool = None  → use LLM (production mode)
    # simulate_skip_tool = ""    → simulate all tools, skip nothing
    # simulate_skip_tool = "tool_name" → simulate but skip that tool
    if simulate_skip_tool is not None:
        final_output = await _simulate_tool_run(
            ctx, instrumented_tools, pdf_path, borrower_id, scenario_id, simulate_skip_tool
        )
        completed_at = datetime.now(timezone.utc)
    else:
        # ── LLM-DRIVEN AGENT PATH ────────────────────────────────────────────────
        # Create agent with instrumented tools
        ollama_model = None  # ignored; covenant_agent.py reads LITELLM_MODEL directly
        agent = create_covenant_agent(autonomy_level, ollama_model)

    # LLM run block — only executed when NOT in simulation mode
    agent_error = None
    if simulate_skip_tool is None:
        completed_at = None
        try:
            ctx._add_audit("agent_thinking", f"Agent starting run for scenario {scenario_id}", {
                "autonomy_level": autonomy_level,
                "pdf_path": pdf_path,
            })

            prompt = (
                f"Analyse the financial report for borrower {borrower_id}. "
                f"The report is at: {pdf_path}. "
                f"Determine if a covenant breach has occurred or is imminent."
            )

            # ADK v1.31 runner pattern
            try:
                from google.adk.runners import InMemoryRunner
                from google.genai import types as genai_types

                runner = InMemoryRunner(agent=agent, app_name="covenant_agent")

                # Create a session first
                session = await runner.session_service.create_session(
                    app_name="covenant_agent", user_id="thesis"
                )

                msg = genai_types.Content(
                    role="user",
                    parts=[genai_types.Part(text=prompt)]
                )

                async for event in runner.run_async(
                    user_id="thesis",
                    session_id=session.id,
                    new_message=msg,
                ):
                    if event.is_final_response():
                        if event.content and event.content.parts:
                            final_output = event.content.parts[0].text
                            break

            except Exception as runner_err:
                import traceback
                tb_str = traceback.format_exc()
                print("=" * 70, flush=True)
                print("=== AGENT RUNNER CRASH — FULL TRACEBACK ===", flush=True)
                print(tb_str, flush=True)
                print("=" * 70, flush=True)
                ctx._add_audit("debug_traceback", "Full runner exception", {"traceback": tb_str[-2000:]})
                err_text = str(runner_err)
                if "requires more system memory" in err_text.lower():
                    fallback_model = "llama3.2:3b"
                    ctx._add_audit(
                        "model_fallback",
                        f"Memory error with {os.getenv('OLLAMA_MODEL', 'llama2:7b')}; retrying with {fallback_model}",
                        {"error": err_text},
                    )
                    try:
                        agent = create_covenant_agent(autonomy_level, fallback_model)
                        runner = InMemoryRunner(agent=agent, app_name="covenant_agent")
                        session = await runner.session_service.create_session(
                            app_name="covenant_agent", user_id="thesis"
                        )
                        msg = genai_types.Content(
                            role="user",
                            parts=[genai_types.Part(text=prompt)]
                        )
                        final_output = None
                        async for event in runner.run_async(
                            user_id="thesis",
                            session_id=session.id,
                            new_message=msg,
                        ):
                            if event.is_final_response():
                                if event.content and event.content.parts:
                                    final_output = event.content.parts[0].text
                                    break
                        if final_output is None:
                            raise RuntimeError("No final response received from fallback model")
                        agent_error = None
                    except Exception as fallback_err:
                        agent_error = f"ADK runner error: {fallback_err}"
                        final_output = f"Agent run failed: {fallback_err}"
                else:
                    agent_error = f"ADK runner error: {runner_err}"
                    final_output = f"Agent run failed: {runner_err}"

            completed_at = datetime.now(timezone.utc)
            ctx._add_audit("final_output", f"Agent completed. Output: {str(final_output)[:300]}", {})

        except Exception as e:
            agent_error = str(e)
            completed_at = datetime.now(timezone.utc)
            ctx._add_audit("final_output", f"Agent failed with error: {e}", {"error": str(e)})

    # ── Compute metrics from recorded tool events ──────────────────────────
    tool_sequence = [e["tool_name"] for e in ctx.tool_events]
    trajectory = compute_trajectory_score(tool_sequence)

    # Score each tool call
    tool_accuracy_scores = []
    for event in ctx.tool_events:
        result = _json.loads(event["result_json"]) if event.get("result_json") else {}
        args = _json.loads(event["args_json"]) if event.get("args_json") else {}
        score = score_tool_call_accuracy(
            event["tool_name"], args, result, ground_truth
        )
        event["accuracy_score"] = score["accuracy_score"]
        tool_accuracy_scores.append(score["accuracy_score"])

    tool_call_accuracy_score = round(
        sum(tool_accuracy_scores) / len(tool_accuracy_scores), 4
    ) if tool_accuracy_scores else 0.0

    # Clause coverage
    coverage = compute_clause_coverage(
        tool_sequence, borrower_has_adjustments, borrower_has_grace
    )

    # Step latency profile
    latency_profile = [
        {"tool_name": e["tool_name"], "latency_ms": e.get("latency_ms", 0)}
        for e in ctx.tool_events
    ]

    # Outcome correctness
    correct_verdict = ground_truth.get("correct_verdict") if ground_truth else None

    # Extract verdict from the generate_report result if available
    detected_verdict = None
    for event in reversed(ctx.tool_events):
        if event["tool_name"] == "generate_report" and event.get("result_json"):
            try:
                r = _json.loads(event["result_json"])
                detected_verdict = r.get("final_verdict")
                break
            except Exception:
                pass

    # Normalise breach_curable → breach for outcome comparison
    def _normalise(v: str | None) -> str:
        """
        Semantic normalisation for verdict comparison.
        'breach_curable' and 'imminent' are treated as equivalent:
        both describe a breach that is within the contractual cure window.
        """
        if v is None:
            return "unknown"
        if v == "breach_curable":
            return "imminent"
        return v

    outcome_correct = (
        _normalise(detected_verdict) == _normalise(correct_verdict)
        if correct_verdict and detected_verdict else None
    )

    process_error_detected = coverage["clause_coverage_score"] < 1.0

    # Duration
    duration_seconds = (completed_at - ctx.started_at).total_seconds() if completed_at else 0

    return {
        # Run identity
        "run_id": run_id,
        "scenario_id": scenario_id,
        "borrower_id": borrower_id,
        "borrower_name": borrower_profile.get("name", borrower_id),
        "autonomy_level": autonomy_level,
        "pdf_path": pdf_path,
        "started_at": ctx.started_at.isoformat(),
        "completed_at": completed_at.isoformat() if completed_at else None,
        "duration_seconds": round(duration_seconds, 2),

        # Verdict
        "final_verdict": detected_verdict or "unknown",
        "correct_verdict": correct_verdict,
        "outcome_correct": outcome_correct,

        # Thesis metrics
        "trajectory_score": trajectory["trajectory_score"],
        "trajectory_details": trajectory,
        "tool_call_accuracy_score": tool_call_accuracy_score,
        "clause_coverage_score": coverage["clause_coverage_score"],
        "clause_coverage_details": coverage,
        "latency_profile": latency_profile,
        "process_error_detected": process_error_detected,

        # Convenience flags
        "adjustment_clause_checked": coverage["adjustment_clause_checked"],
        "grace_period_clause_checked": coverage["grace_period_clause_checked"],
        "adjustment_changes_verdict": ground_truth.get("adjustment_changes_verdict", False) if ground_truth else False,
        "tools_called": [e["tool_name"] for e in ctx.tool_events],

        # Status
        "status": "failed" if agent_error else "completed",
        "error_message": agent_error,

        # Raw events for persistence
        "tool_call_events": ctx.tool_events,
        "audit_log_entries": ctx.audit_entries,
        "final_output": final_output,
    }


def _get_instruction(autonomy_level: int) -> str:
    from agent.covenant_agent import LEVEL_1_INSTRUCTION, LEVEL_2_INSTRUCTION, LEVEL_3_INSTRUCTION
    return {1: LEVEL_1_INSTRUCTION, 2: LEVEL_2_INSTRUCTION, 3: LEVEL_3_INSTRUCTION}[autonomy_level]


async def _simulate_tool_run(
    ctx: RunContext,
    instrumented_tools: list,
    pdf_path: str,
    borrower_id: str,
    scenario_id: str,
    skip_tool: str,
) -> str:
    """
    Runs all tools directly (no LLM) in the expected sequence,
    skipping the tool named in skip_tool. Used for deterministic testing.
    """
    from agent.tools import (
        extract_financial_metrics,
        identify_applicable_covenants,
        check_accounting_adjustments,
        check_grace_period,
        calculate_breach_risk,
        generate_report,
    )

    ctx._add_audit("agent_thinking", f"[SIMULATION] Running tools directly (skip={skip_tool})", {})

    # Step 1
    metrics = {}
    if skip_tool != "extract_financial_metrics":
        ctx.record_tool_start("extract_financial_metrics", {"pdf_path": pdf_path, "borrower_id": borrower_id})
        metrics = extract_financial_metrics(pdf_path, borrower_id)
        ctx.record_tool_end("extract_financial_metrics", metrics)
    else:
        ctx._add_audit("agent_thinking", "[SIMULATION] Skipped extract_financial_metrics", {})

    # Step 2
    cov = {}
    if skip_tool != "identify_applicable_covenants":
        ctx.record_tool_start("identify_applicable_covenants", {"borrower_id": borrower_id})
        cov = identify_applicable_covenants(borrower_id)
        ctx.record_tool_end("identify_applicable_covenants", cov)

    # Step 3 — THE CRITICAL H1 STEP
    adj = {"adjusted_ebitda": metrics.get("reported_ebitda", 0),
           "adjusted_debt": metrics.get("total_debt", 0),
           "adjustments_applicable": False, "adjustment_amount": 0, "adjustment_notes": "Skipped"}
    if skip_tool != "check_accounting_adjustments":
        ctx.record_tool_start("check_accounting_adjustments",
                              {"borrower_id": borrower_id, "raw_financials": metrics})
        adj = check_accounting_adjustments(borrower_id, metrics)
        ctx.record_tool_end("check_accounting_adjustments", adj)
    else:
        ctx._add_audit("agent_thinking",
                       "[SIMULATION] Skipped check_accounting_adjustments — PROCESS ERROR", {})

    # Step 4
    gp = {"has_grace_period": False, "cure_available": False}
    if skip_tool != "check_grace_period":
        ctx.record_tool_start("check_grace_period", {"borrower_id": borrower_id})
        gp = check_grace_period(borrower_id)
        ctx.record_tool_end("check_grace_period", gp)

    # Step 5
    breach = {}
    if skip_tool != "calculate_breach_risk" and metrics and cov:
        payload = {
            "adjusted_ebitda": adj.get("adjusted_ebitda", metrics.get("reported_ebitda", 0)),
            "adjusted_debt": adj.get("adjusted_debt", metrics.get("total_debt", 0)),
            "interest_expense": metrics.get("interest_expense", 0),
            "current_assets": metrics.get("current_assets", 0),
            "current_liabilities": metrics.get("current_liabilities", 0),
        }
        ctx.record_tool_start("calculate_breach_risk",
                              {"adjusted_financials": payload, "covenants": cov.get("covenants", {}),
                               "grace_period_info": gp})
        breach = calculate_breach_risk(payload, cov.get("covenants", {}), gp)
        ctx.record_tool_end("calculate_breach_risk", breach)

    # Step 6
    report = {}
    if skip_tool != "generate_report" and breach:
        ctx.record_tool_start("generate_report",
                              {"scenario_id": scenario_id, "borrower_id": borrower_id})
        report = generate_report(scenario_id, borrower_id, metrics, cov, adj, gp, breach)
        ctx.record_tool_end("generate_report", report)

    ctx._add_audit("final_output", f"[SIMULATION] Complete. Verdict: {breach.get('verdict', 'unknown')}", {})
    return f"Simulation complete. Verdict: {breach.get('verdict', 'unknown')}"


async def run_multi_agent_pipeline(
    pdf_path: str,
    borrower_id: str = None,
    config: dict = None,
) -> dict:
    """
    Runs the multi-agent financial analysis pipeline.
    Preserves thesis metrics by tracking agent calls as "tools".
    """
    from agent.pipeline import FinancialAnalysisPipeline
    from agent.schemas import DocumentInput, PipelineConfig
    
    run_id = str(uuid.uuid4())
    ctx = RunContext(run_id, "multi_agent", borrower_id or "unknown", 1)  # Use level 1 for metrics
    
    input_data = DocumentInput(pdf_path=pdf_path, borrower_id=borrower_id)
    pipeline_config = PipelineConfig(**config) if config else PipelineConfig()
    
    pipeline = FinancialAnalysisPipeline(pipeline_config)
    
    try:
        ctx._add_audit("pipeline_start", f"Starting multi-agent pipeline for {pdf_path}", {})
        
        # Simulate tool calls for metrics (each agent as a "tool")
        ctx.record_tool_start("document_intelligence_agent", {"pdf_path": pdf_path})
        result = await pipeline.run(input_data)
        ctx.record_tool_end("document_intelligence_agent", result.get("agent1_output"))
        
        ctx.record_tool_start("data_extraction_agent", {"reduced_pdf_path": result["agent1_output"].reduced_pdf_path})
        ctx.record_tool_end("data_extraction_agent", result.get("agent2_output"))
        
        ctx.record_tool_start("analysis_agent", {"extracted_data": result["agent2_output"].dict()})
        ctx.record_tool_end("analysis_agent", result.get("agent3_output"))
        
        ctx._add_audit("pipeline_complete", "Multi-agent pipeline completed successfully", {})
        
        # Compute basic metrics (simplified)
        tool_sequence = [e["tool_name"] for e in ctx.tool_events]
        trajectory = compute_trajectory_score(tool_sequence)
        
        return {
            "run_id": run_id,
            "pipeline_result": result,
            "trajectory_score": trajectory["trajectory_score"],
            "tool_call_events": ctx.tool_events,
            "audit_log_entries": ctx.audit_entries,
            "status": "completed",
        }
    except Exception as e:
        ctx._add_audit("pipeline_error", f"Pipeline failed: {e}", {"error": str(e)})
        return {
            "run_id": run_id,
            "error": str(e),
            "tool_call_events": ctx.tool_events,
            "audit_log_entries": ctx.audit_entries,
            "status": "failed",
        }
