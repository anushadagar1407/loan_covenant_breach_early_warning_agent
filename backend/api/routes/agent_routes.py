"""
api/routes/agent_routes.py
===========================
Endpoints for triggering and querying agent runs.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database.db import get_db
from database.models import AgentRun, ToolCallEvent, AuditLogEntry

router = APIRouter()

GROUND_TRUTH_PATH = Path(__file__).parent.parent.parent / "data" / "ground_truth.json"
PDFS_PATH = Path(__file__).parent.parent.parent / "data" / "synthetic_pdfs"


class RunRequest(BaseModel):
    scenario_id: str
    autonomy_level: int = 1


class MultiAgentRequest(BaseModel):
    pdf_path: str
    borrower_id: Optional[str] = None
    config: Optional[dict] = None


async def _execute_run(run_id: str, scenario_id: str, autonomy_level: int):
    """Background task: runs agent and persists results."""
    from database.db import AsyncSessionLocal
    from agent.agent_runner import run_agent_with_metrics

    # Load scenario
    with open(GROUND_TRUTH_PATH) as f:
        gt_data = json.load(f)
    scenario = next((s for s in gt_data["scenarios"] if s["scenario_id"] == scenario_id), None)
    if not scenario:
        return

    pdf_path = str(PDFS_PATH / scenario.get("pdf_filename", f"{scenario_id}.pdf"))

    run_result = await run_agent_with_metrics(
        scenario_id=scenario_id,
        borrower_id=scenario["borrower_id"],
        pdf_path=pdf_path,
        autonomy_level=autonomy_level,
        ground_truth=scenario,
    )

    # Persist to database
    async with AsyncSessionLocal() as db:
        run = AgentRun(
            run_id=run_id,
            scenario_id=scenario_id,
            borrower_id=run_result["borrower_id"],
            borrower_name=run_result["borrower_name"],
            autonomy_level=autonomy_level,
            pdf_path=pdf_path,
            started_at=datetime.fromisoformat(run_result["started_at"]),
            completed_at=datetime.fromisoformat(run_result["completed_at"]) if run_result.get("completed_at") else None,
            duration_seconds=run_result.get("duration_seconds"),
            final_verdict=run_result.get("final_verdict"),
            correct_verdict=run_result.get("correct_verdict"),
            outcome_correct=run_result.get("outcome_correct"),
            trajectory_score=run_result.get("trajectory_score"),
            tool_call_accuracy_score=run_result.get("tool_call_accuracy_score"),
            clause_coverage_score=run_result.get("clause_coverage_score"),
            process_error_detected=run_result.get("process_error_detected", False),
            adjustment_clause_checked=run_result.get("adjustment_clause_checked", False),
            grace_period_clause_checked=run_result.get("grace_period_clause_checked", False),
            adjustment_changes_verdict=run_result.get("adjustment_changes_verdict", False),
            status=run_result.get("status", "completed"),
            error_message=run_result.get("error_message"),
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
async def start_run(request: RunRequest, background_tasks: BackgroundTasks):
    """
    Trigger a new agent run. Returns immediately with run_id.
    The agent executes in a background task.
    """
    import uuid

    # Validate scenario
    if not GROUND_TRUTH_PATH.exists():
        raise HTTPException(status_code=500, detail="ground_truth.json not found")

    with open(GROUND_TRUTH_PATH) as f:
        gt_data = json.load(f)
    if not any(s["scenario_id"] == request.scenario_id for s in gt_data["scenarios"]):
        raise HTTPException(status_code=404, detail=f"Scenario {request.scenario_id} not found")

    if request.autonomy_level not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="autonomy_level must be 1, 2, or 3")

    run_id = str(uuid.uuid4())
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

    return {
        **run.to_dict(),
        "tool_call_events": [t.to_dict() for t in tools],
        "audit_log_entries": [a.to_dict() for a in audit],
    }


@router.get("/scenarios")
async def list_scenarios():
    """List all available test scenarios."""
    if not GROUND_TRUTH_PATH.exists():
        raise HTTPException(status_code=500, detail="ground_truth.json not found")
    with open(GROUND_TRUTH_PATH) as f:
        data = json.load(f)
    return {"scenarios": data["scenarios"]}


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
