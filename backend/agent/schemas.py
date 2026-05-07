"""
schemas.py
==========
Pydantic models for standardized data formats in the multi-agent pipeline.
Ensures type safety and validation for inter-agent communication.
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional


class DocumentInput(BaseModel):
    pdf_path: str = Field(..., description="Path or URL to the full PDF report")
    borrower_id: Optional[str] = Field(None, description="Borrower identifier for context")


class ReducedDocumentOutput(BaseModel):
    relevant_pages: List[int] = Field(..., description="List of relevant page numbers (1-based)")
    reduced_pdf_path: str = Field(..., description="Path to the created reduced PDF")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score for page selection")


class ExtractedDataOutput(BaseModel):
    company_name: Optional[str] = Field(None, description="Extracted company name")
    financial_data: Dict[str, float] = Field(..., description="Extracted financial metrics (e.g., {'total_debt': 1000000.0})")
    computed_ratios: Dict[str, float] = Field(..., description="Computed financial ratios (e.g., {'debt_ratio': 0.45, 'equity_debt_ratio': 1.2, 'roe': 0.15, 'roa': 0.08})")
    extraction_confidence: float = Field(..., ge=0.0, le=1.0, description="Overall extraction confidence")


class AnalysisOutput(BaseModel):
    trends: List[Dict[str, str]] = Field(..., description="List of trend analyses (e.g., [{'ratio': 'debt_ratio', 'trend': 'increasing', 'insight': 'Potential risk'}])")
    insights: str = Field(..., description="Human-readable insights summary")
    recommendations: List[str] = Field(..., description="List of recommendations")


class PipelineConfig(BaseModel):
    agent_order: List[str] = Field(["document_intelligence", "data_extraction", "analysis"], description="Order of agents in the pipeline")
    timeouts: Dict[str, int] = Field({"document_intelligence": 300, "data_extraction": 300, "analysis": 300}, description="Timeouts in seconds per agent")
    required_ratios: List[str] = Field(["debt_ratio", "equity_debt_ratio", "roe", "roa"], description="Ratios to compute in Agent 2")