"""
multi_agents.py
===============
Definitions for the three specialized agents in the multi-agent pipeline.
Uses Google ADK with Ollama.
"""

import os

os.environ.setdefault("LITELLM_LOCAL_MODEL_COST_MAP", "True")

from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm
from google.genai import types as genai_types

from agent.tools.document_intelligence import scan_pdf_pages, identify_relevant_pages, create_reduced_pdf
from agent.tools.data_extraction import parse_reduced_pdf, extract_table_data, compute_financial_ratios, extract_company_name
from agent.tools.analysis import analyze_trends, generate_insights, generate_recommendations


def create_document_intelligence_agent() -> Agent:
    """
    Agent 1: Document Intelligence Agent.
    Scans PDF, identifies relevant pages, creates reduced PDF.
    """
    instruction = """
    You are a Document Intelligence Agent. Your task is to analyze a full financial report PDF and identify relevant pages containing financial tables or key data (e.g., company name, debt, equity, ratios).

    Follow these steps:
    1. Scan the full PDF to get all pages.
    2. Identify relevant pages based on financial keywords.
    3. Create a reduced PDF with only those pages.
    4. Return the relevant pages, reduced PDF path, and confidence score.

    The output MUST be valid JSON with keys: relevant_pages, reduced_pdf_path, confidence.
    Use the tools: scan_pdf_pages, identify_relevant_pages, create_reduced_pdf.
    """

    ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    ollama_model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

    os.environ.setdefault("OLLAMA_API_BASE", ollama_host)

    model = LiteLlm(
        model=f"ollama/{ollama_model}",
    )

    return Agent(
        name="document_intelligence_agent",
        model=model,
        instruction=instruction,
        generate_content_config=genai_types.GenerateContentConfig(temperature=0.1),
        tools=[scan_pdf_pages, identify_relevant_pages, create_reduced_pdf],
    )


def create_data_extraction_agent() -> Agent:
    """
    Agent 2: Data Extraction & Calculation Agent.
    Parses reduced PDF, extracts data, computes ratios.
    """
    instruction = """
    You are a Data Extraction & Calculation Agent. Your task is to parse the reduced PDF, extract structured financial data from tables, and compute required financial ratios.

    Follow these steps:
    1. Parse the reduced PDF to extract tables.
    2. Extract key financial data (e.g., total_debt, total_equity).
    3. Compute ratios like debt_ratio, equity_debt_ratio, ROE, ROA.
    4. Return extracted data, computed ratios, and confidence.

    The output MUST be valid JSON with keys: company_name, financial_data, computed_ratios, extraction_confidence.
    Use the tools: parse_reduced_pdf, extract_table_data, compute_financial_ratios, extract_company_name.
    """

    ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    ollama_model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

    os.environ.setdefault("OLLAMA_API_BASE", ollama_host)

    model = LiteLlm(
        model=f"ollama/{ollama_model}",
    )

    return Agent(
        name="data_extraction_agent",
        model=model,
        instruction=instruction,
        generate_content_config=genai_types.GenerateContentConfig(temperature=0.1),
        tools=[parse_reduced_pdf, extract_table_data, compute_financial_ratios, extract_company_name],
    )


def create_analysis_agent() -> Agent:
    """
    Agent 3: Analysis Agent.
    Analyzes trends, generates insights.
    """
    instruction = """
    You are an Analysis Agent. Your task is to analyze extracted financial data for trends, trajectories, and insights.

    Follow these steps:
    1. Analyze trends in the ratios.
    2. Generate human-readable insights.
    3. Provide recommendations based on the analysis.

    The output MUST be valid JSON with keys: trends, insights, recommendations.
    Use the tools: analyze_trends, generate_insights, generate_recommendations.
    """

    ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    ollama_model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

    os.environ.setdefault("OLLAMA_API_BASE", ollama_host)

    model = LiteLlm(
        model=f"ollama/{ollama_model}",
    )

    return Agent(
        name="analysis_agent",
        model=model,
        instruction=instruction,
        generate_content_config=genai_types.GenerateContentConfig(temperature=0.1),
        tools=[analyze_trends, generate_insights, generate_recommendations],
    )
