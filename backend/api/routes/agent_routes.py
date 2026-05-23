"""
api/routes/agent_routes.py
===========================
Endpoints for triggering and querying agent runs.
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database.db import get_db
from database.models import AgentRun, ToolCallEvent, AuditLogEntry
from agent.scenario_catalog import get_pdf_scenario, list_pdf_scenarios

router = APIRouter()
logger = logging.getLogger(__name__)

BORROWER_PROFILES_PATH = Path(__file__).parent.parent.parent / "data" / "borrower_profiles.json"


class RunRequest(BaseModel):
    scenario_id: str
    autonomy_level: int = 1


class MultiAgentRequest(BaseModel):
    pdf_path: str
    borrower_id: Optional[str] = None
    config: Optional[dict] = None


def _load_scenario(scenario_id: str) -> dict | None:
    return get_pdf_scenario(scenario_id)


def _load_borrower_name(borrower_id: str) -> str:
    if not BORROWER_PROFILES_PATH.exists():
        return borrower_id
    with open(BORROWER_PROFILES_PATH) as f:
        profiles = json.load(f)
    borrower = next((b for b in profiles.get("borrowers", []) if b["borrower_id"] == borrower_id), None)
    return borrower.get("name", borrower_id) if borrower else borrower_id


async def _upsert_run_row(db, run_id: str, scenario: dict, autonomy_level: int, pdf_path: str, status: str, run_result: dict | None = None, error_message: str | None = None):
    run = await db.execute(select(AgentRun).where(AgentRun.run_id == run_id))
    run = run.scalar_one_or_none()
    if not run:
        run = AgentRun(
            run_id=run_id,
            scenario_id=scenario["scenario_id"],
            borrower_id=scenario["borrower_id"],
            borrower_name=_load_borrower_name(scenario["borrower_id"]),
            autonomy_level=autonomy_level,
            pdf_path=pdf_path,
            started_at=datetime.utcnow(),
            status=status,
        )
        db.add(run)

    run.scenario_id = scenario["scenario_id"]
    run.borrower_id = scenario["borrower_id"]
    run.borrower_name = run_result.get("borrower_name", _load_borrower_name(scenario["borrower_id"])) if run_result else _load_borrower_name(scenario["borrower_id"])
    run.autonomy_level = autonomy_level
    run.pdf_path = pdf_path
    run.status = status
    if run_result:
        run.started_at = datetime.fromisoformat(run_result["started_at"])
        run.completed_at = datetime.fromisoformat(run_result["completed_at"]) if run_result.get("completed_at") else None
        run.duration_seconds = run_result.get("duration_seconds")
        run.final_verdict = run_result.get("final_verdict")
        run.correct_verdict = run_result.get("correct_verdict")
        run.outcome_correct = run_result.get("outcome_correct")
        run.trajectory_score = run_result.get("trajectory_score")
        run.tool_call_accuracy_score = run_result.get("tool_call_accuracy_score")
        run.clause_coverage_score = run_result.get("clause_coverage_score")
        run.process_error_detected = run_result.get("process_error_detected", False)
        run.adjustment_clause_checked = run_result.get("adjustment_clause_checked", False)
        run.grace_period_clause_checked = run_result.get("grace_period_clause_checked", False)
        run.adjustment_changes_verdict = run_result.get("adjustment_changes_verdict", False)
        run.breach_severity_score = run_result.get("breach_severity_score")
        run.error_message = run_result.get("error_message")
        run.pipeline_result_json = json.dumps(run_result, default=str)
    elif error_message is not None:
        run.error_message = error_message
    return run


async def _execute_run(run_id: str, scenario_id: str, autonomy_level: int):
    """Background task: runs agent and persists results."""
    from database.db import AsyncSessionLocal
    from agent.agent_runner import run_agent_with_metrics

    scenario = _load_scenario(scenario_id)
    if not scenario:
        logger.error("Scenario not found for background run: %s", scenario_id)
        return

    async with AsyncSessionLocal() as db:
        try:
            run_result = await run_agent_with_metrics(
                scenario_id=scenario_id,
                borrower_id=scenario["borrower_id"],
                pdf_path=scenario["pdf_path"],
                autonomy_level=autonomy_level,
                ground_truth=scenario,
                run_id=run_id,
            )

            run = await _upsert_run_row(
                db,
                run_id=run_id,
                scenario=scenario,
                autonomy_level=autonomy_level,
                pdf_path=scenario["pdf_path"],
                status=run_result.get("status", "completed"),
                run_result=run_result,
            )
            db.add(run)

        except Exception as exc:
            logger.exception("Agent run failed for %s", run_id)
            run = await _upsert_run_row(
                db,
                run_id=run_id,
                scenario=scenario,
                autonomy_level=autonomy_level,
                pdf_path=scenario["pdf_path"],
                status="failed",
                error_message=str(exc),
            )
            db.add(run)
            await db.commit()
            return

        for event in run_result.get("tool_call_events", []):
            te = ToolCallEvent(
                run_id=run_id,
                tool_name=event["tool_name"],
                call_order=event["call_order"],
                called_at=datetime.fromisoformat(event["called_at"]) if event.get("called_at") else None,
                completed_at=datetime.fromisoformat(event["completed_at"]) if event.get("completed_at") else None,
                latency_ms=event.get("latency_ms"),
                args_json=event.get("args_json"),
                result_json=event.get("result_json"),
                accuracy_score=event.get("accuracy_score"),
                error=event.get("error"),
            )
            db.add(te)

        for entry in run_result.get("audit_log_entries", []):
            al = AuditLogEntry(
                run_id=run_id,
                timestamp=datetime.fromisoformat(entry["timestamp"]) if entry.get("timestamp") else None,
                event_type=entry["event_type"],
                message=entry["message"],
                metadata_json=entry.get("metadata_json"),
            )
            db.add(al)

        await db.commit()


@router.post("/runs")
async def start_run(
    request: RunRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger a new agent run. Returns immediately with run_id.
    The agent executes in a background task.
    """
    import uuid

    scenario = _load_scenario(request.scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail=f"Scenario {request.scenario_id} not found")

    if request.autonomy_level not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="autonomy_level must be 1, 2, or 3")

    run_id = str(uuid.uuid4())
    pending_run = AgentRun(
        run_id=run_id,
        scenario_id=scenario["scenario_id"],
        borrower_id=scenario["borrower_id"],
        borrower_name=_load_borrower_name(scenario["borrower_id"]),
        autonomy_level=request.autonomy_level,
        pdf_path=scenario["pdf_path"],
        started_at=datetime.utcnow(),
        status="running",
    )
    db.add(pending_run)
    await db.commit()

    background_tasks.add_task(_execute_run, run_id, request.scenario_id, request.autonomy_level)

    return {"run_id": run_id, "status": "started", "scenario_id": request.scenario_id}


@router.get("/runs")
async def list_runs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    autonomy_level: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List all agent runs, newest first."""
    q = select(AgentRun).order_by(desc(AgentRun.started_at))
    if autonomy_level:
        q = q.where(AgentRun.autonomy_level == autonomy_level)

    offset = (page - 1) * per_page
    q = q.offset(offset).limit(per_page)
    result = await db.execute(q)
    runs = result.scalars().all()
    return {"runs": [r.to_dict() for r in runs], "page": page, "per_page": per_page}


@router.get("/runs/{run_id}")
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)):
    """Get full detail for a single run including tool events and audit log."""
    run_result = await db.execute(select(AgentRun).where(AgentRun.run_id == run_id))
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    tools_result = await db.execute(
        select(ToolCallEvent).where(ToolCallEvent.run_id == run_id).order_by(ToolCallEvent.call_order)
    )
    tools = tools_result.scalars().all()

    audit_result = await db.execute(
        select(AuditLogEntry).where(AuditLogEntry.run_id == run_id).order_by(AuditLogEntry.timestamp)
    )
    audit = audit_result.scalars().all()

    payload = {
        **run.to_dict(),
        "tool_call_events": [t.to_dict() for t in tools],
        "audit_log_entries": [a.to_dict() for a in audit],
    }
    pipeline_result = payload.get("pipeline_result") or {}
    pipeline_result = pipeline_result if isinstance(pipeline_result, dict) else {}
    stored_pipeline = payload.get("pipeline_result")
    stored_pipeline = stored_pipeline if isinstance(stored_pipeline, dict) else {}
    h1_evidence = []
    h2_evidence = []
    if payload.get("outcome_correct") and payload.get("process_error_detected"):
        h1_evidence = [{
            "run_id": payload.get("run_id"),
            "scenario_id": payload.get("scenario_id"),
            "borrower_id": payload.get("borrower_id"),
            "borrower_name": payload.get("borrower_name"),
            "autonomy_level": payload.get("autonomy_level"),
            "clause_coverage_score": payload.get("clause_coverage_score"),
            "final_verdict": payload.get("final_verdict"),
        }]
    if payload.get("autonomy_level") in (1, 2, 3):
        h2_evidence = [{
            "autonomy_level": payload.get("autonomy_level"),
            "process_error_detected": payload.get("process_error_detected"),
            "clause_coverage_score": payload.get("clause_coverage_score"),
        }]
    return {
        **payload,
        "clauseCoverage": payload.get("clause_coverage_score"),
        "trajectory": pipeline_result.get("trajectory_details"),
        "verdict": payload.get("final_verdict"),
        "h1Evidence": h1_evidence,
        "h2Evidence": h2_evidence,
        "pdfScenario": pipeline_result.get("pdfScenario") or stored_pipeline.get("pdfScenario"),
        "scenario_inputs": pipeline_result.get("scenario_inputs") or stored_pipeline.get("scenario_inputs"),
        "tool_accuracy_details": pipeline_result.get("tool_accuracy_details") or stored_pipeline.get("tool_accuracy_details", []),
        "clause_coverage_details": pipeline_result.get("clause_coverage_details") or stored_pipeline.get("clause_coverage_details"),
        "research_signals": pipeline_result.get("research_signals") or stored_pipeline.get("research_signals"),
    }


@router.get("/scenarios")
async def list_scenarios():
    """List all available test scenarios."""
    return {"scenarios": list_pdf_scenarios()}


@router.post("/multi-agent")
async def start_multi_agent_run(request: MultiAgentRequest, background_tasks: BackgroundTasks):
    """
    Trigger a multi-agent financial analysis pipeline run.
    Returns immediately with run_id.
    """
    import uuid
    from agent.agent_runner import run_multi_agent_pipeline

    run_id = str(uuid.uuid4())
    
    # Run in background
    background_tasks.add_task(_execute_multi_run, run_id, request.pdf_path, request.borrower_id, request.config)

    return {"run_id": run_id, "status": "started", "pdf_path": request.pdf_path}


async def _execute_multi_run(run_id: str, pdf_path: str, borrower_id: str, config: dict):
    """Background task: runs multi-agent pipeline and persists results."""
    from database.db import AsyncSessionLocal
    from database.models import AgentRun, ToolCallEvent, AuditLogEntry
    from agent.agent_runner import run_multi_agent_pipeline

    run_result = await run_multi_agent_pipeline(pdf_path=pdf_path, borrower_id=borrower_id, config=config)

    # Persist to database (simplified, reuse AgentRun but mark as multi-agent)
    async with AsyncSessionLocal() as db:
        run = AgentRun(
            run_id=run_id,
            scenario_id="multi_agent",
            borrower_id=borrower_id or "unknown",
            borrower_name=borrower_id or "Unknown",
            autonomy_level=1,  # Fixed for multi-agent
            pdf_path=pdf_path,
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
            duration_seconds=0,  # Not tracked
            final_verdict="multi_agent_completed",
            status=run_result.get("status", "completed"),
            error_message=run_result.get("error"),
            pipeline_result_json=json.dumps(run_result.get("pipeline_result", {}), default=str),
        )
        db.add(run)

        for event in run_result.get("tool_call_events", []):
            te = ToolCallEvent(
                run_id=run_id,
                tool_name=event["tool_name"],
                call_order=event["call_order"],
                called_at=datetime.fromisoformat(event["called_at"]) if event.get("called_at") else None,
                completed_at=datetime.fromisoformat(event["completed_at"]) if event.get("completed_at") else None,
                latency_ms=event.get("latency_ms"),
                args_json=event.get("args_json"),
                result_json=json.dumps(event.get("result_json", {}), default=str),
                accuracy_score=event.get("accuracy_score"),
                error=event.get("error"),
            )
            db.add(te)

        for entry in run_result.get("audit_log_entries", []):
            al = AuditLogEntry(
                run_id=run_id,
                timestamp=datetime.fromisoformat(entry["timestamp"]) if entry.get("timestamp") else None,
                event_type=entry["event_type"],
                message=entry["message"],
                metadata_json=entry.get("metadata_json"),
            )
            db.add(al)

        await db.commit()
