"""
database/models.py
==================
SQLAlchemy ORM models for persisting all agent run data.

Three tables:
  agent_runs        — one row per agent run, all aggregated metrics
  tool_call_events  — one row per tool call within a run
  audit_log_entries — one row per audit event (fine-grained trace)
"""

import json
from datetime import datetime
from sqlalchemy import (
    Boolean, Column, DateTime, Float, Integer, String, Text, ForeignKey
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), unique=True, nullable=False, index=True)
    scenario_id = Column(String(50), nullable=False)
    borrower_id = Column(String(50), nullable=False)
    borrower_name = Column(String(200))
    autonomy_level = Column(Integer, nullable=False)
    pdf_path = Column(String(500))
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    duration_seconds = Column(Float)
    final_verdict = Column(String(50))
    correct_verdict = Column(String(50))
    outcome_correct = Column(Boolean)

    # Thesis metrics
    trajectory_score = Column(Float)
    tool_call_accuracy_score = Column(Float)
    clause_coverage_score = Column(Float)
    process_error_detected = Column(Boolean, default=False)
    data_source = Column(String(50))
    ground_truth_fallback_used = Column(Boolean, default=False)
    experiment_condition = Column(String(50), default="standard")
    transparency_artifacts_present = Column(Boolean, default=False)

    # Clause-level flags
    adjustment_clause_checked = Column(Boolean, default=False)
    grace_period_clause_checked = Column(Boolean, default=False)
    adjustment_changes_verdict = Column(Boolean, default=False)

    # Additional info
    breach_severity_score = Column(Float)
    status = Column(String(20), default="running")
    error_message = Column(Text)
    pipeline_result_json = Column(Text)  # For multi-agent: stores full analysis output

    def to_dict(self) -> dict:
        return {
            "run_id": self.run_id,
            "scenario_id": self.scenario_id,
            "borrower_id": self.borrower_id,
            "borrower_name": self.borrower_name,
            "autonomy_level": self.autonomy_level,
            "pdf_path": self.pdf_path,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_seconds": self.duration_seconds,
            "final_verdict": self.final_verdict,
            "correct_verdict": self.correct_verdict,
            "outcome_correct": self.outcome_correct,
            "trajectory_score": self.trajectory_score,
            "tool_call_accuracy_score": self.tool_call_accuracy_score,
            "clause_coverage_score": self.clause_coverage_score,
            "process_error_detected": self.process_error_detected,
            "data_source": self.data_source,
            "ground_truth_fallback_used": self.ground_truth_fallback_used,
            "experiment_condition": self.experiment_condition,
            "transparency_artifacts_present": self.transparency_artifacts_present,
            "adjustment_clause_checked": self.adjustment_clause_checked,
            "grace_period_clause_checked": self.grace_period_clause_checked,
            "adjustment_changes_verdict": self.adjustment_changes_verdict,
            "breach_severity_score": self.breach_severity_score,
            "status": self.status,
            "error_message": self.error_message,
            "pipeline_result": json.loads(self.pipeline_result_json) if self.pipeline_result_json else None,
        }


class ToolCallEvent(Base):
    __tablename__ = "tool_call_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), ForeignKey("agent_runs.run_id"), nullable=False, index=True)
    tool_name = Column(String(100), nullable=False)
    call_order = Column(Integer, nullable=False)
    called_at = Column(DateTime)
    completed_at = Column(DateTime)
    latency_ms = Column(Float)
    args_json = Column(Text)
    result_json = Column(Text)
    accuracy_score = Column(Float)
    error = Column(Text)

    def to_dict(self) -> dict:
        return {
            "tool_name": self.tool_name,
            "call_order": self.call_order,
            "called_at": self.called_at.isoformat() if self.called_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "latency_ms": self.latency_ms,
            "accuracy_score": self.accuracy_score,
            "error": self.error,
        }


class AuditLogEntry(Base):
    __tablename__ = "audit_log_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), ForeignKey("agent_runs.run_id"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    event_type = Column(String(50), nullable=False)
    message = Column(Text, nullable=False)
    metadata_json = Column(Text)

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "event_type": self.event_type,
            "message": self.message,
        }


class TrustResponse(Base):
    __tablename__ = "trust_responses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    response_id = Column(String(36), unique=True, nullable=False, index=True)
    run_id = Column(String(36), ForeignKey("agent_runs.run_id"), nullable=False, index=True)
    stakeholder_group = Column(String(50), nullable=False)
    transparency_condition = Column(String(50), nullable=False)
    response_source = Column(String(50), default="human")
    trust_score = Column(Float, nullable=False)
    auditability_score = Column(Float)
    reliability_score = Column(Float)
    explanation_sufficiency_score = Column(Float)
    comments = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "response_id": self.response_id,
            "run_id": self.run_id,
            "stakeholder_group": self.stakeholder_group,
            "transparency_condition": self.transparency_condition,
            "response_source": self.response_source,
            "trust_score": self.trust_score,
            "auditability_score": self.auditability_score,
            "reliability_score": self.reliability_score,
            "explanation_sufficiency_score": self.explanation_sufficiency_score,
            "comments": self.comments,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
