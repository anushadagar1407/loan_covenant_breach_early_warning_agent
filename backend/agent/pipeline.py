"""
pipeline.py
===========
Orchestrator for the multi-agent financial analysis pipeline.
Coordinates Agent 1 → Agent 2 → Agent 3.
"""

import asyncio
import json
import logging
from typing import Dict, Any, Optional
from agent.schemas import DocumentInput, ReducedDocumentOutput, ExtractedDataOutput, AnalysisOutput, PipelineConfig
from agent.multi_agents import create_document_intelligence_agent, create_data_extraction_agent, create_analysis_agent
from agent.tools.document_intelligence import scan_pdf_pages, identify_relevant_pages, create_reduced_pdf
from agent.tools.data_extraction import parse_reduced_pdf, extract_table_data, compute_financial_ratios, extract_company_name
from agent.tools.analysis import analyze_trends, generate_insights, generate_recommendations

from google.adk.runners import InMemoryRunner
from google.genai import types as genai_types

logger = logging.getLogger(__name__)


class FinancialAnalysisPipeline:
    def __init__(self, config: PipelineConfig = None):
        self.config = config or PipelineConfig()
        self.agents = {
            "document_intelligence": create_document_intelligence_agent(),
            "data_extraction": create_data_extraction_agent(),
            "analysis": create_analysis_agent(),
        }
        self.state: Dict[str, Any] = {}

    async def run(self, input_data: DocumentInput) -> Dict[str, Any]:
        """
        Runs the full pipeline.
        """
        self.state["input"] = input_data
        
        # Agent 1: Document Intelligence
        agent1_output = await self._run_agent("document_intelligence", {"pdf_path": input_data.pdf_path})
        if self._output_failed(agent1_output):
            return await self._tool_only_fallback(input_data, failed_stage="document_intelligence", error_context=agent1_output)
        reduced_output = ReducedDocumentOutput(**agent1_output)
        self.state["agent1_output"] = reduced_output

        # Agent 2: Data Extraction
        agent2_input = {
            "reduced_pdf_path": reduced_output.reduced_pdf_path,
            "required_ratios": self.config.required_ratios
        }
        agent2_output = await self._run_agent("data_extraction", agent2_input)
        if self._output_failed(agent2_output):
            return await self._tool_only_fallback(input_data, failed_stage="data_extraction", error_context=agent2_output)
        extracted_output = ExtractedDataOutput(**agent2_output)
        self.state["agent2_output"] = extracted_output

        # Agent 3: Analysis
        agent3_input = {
            "extracted_data": extracted_output.dict(),
            "historical_data": []  # Can be extended
        }
        agent3_output = await self._run_agent("analysis", agent3_input)
        if self._output_failed(agent3_output):
            return await self._tool_only_fallback(input_data, failed_stage="analysis", error_context=agent3_output)
        analysis_output = AnalysisOutput(**agent3_output)
        self.state["agent3_output"] = analysis_output

        return self.state

    async def _run_agent(self, agent_name: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Runs a single agent with inputs.
        """
        agent = self.agents[agent_name]
        timeout = self.config.timeouts.get(agent_name, 300)

        try:
            runner = InMemoryRunner(agent=agent, app_name=f"pipeline_{agent_name}")
            session = await runner.session_service.create_session(
                app_name=f"pipeline_{agent_name}",
                user_id="pipeline",
            )

            prompt = (
                "Use the tools and instructions assigned to you to process the input. "
                "Return a single JSON object with the required output fields only. "
                f"Input: {json.dumps(inputs)}"
            )
            message = genai_types.Content(
                role="user",
                parts=[genai_types.Part(text=prompt)],
            )

            final_text = None
            async for event in runner.run_async(
                user_id="pipeline",
                session_id=session.id,
                new_message=message,
            ):
                if hasattr(event, "is_final_response") and event.is_final_response():
                    if event.content and event.content.parts:
                        final_text = event.content.parts[0].text

            if not final_text:
                raise RuntimeError("Agent did not return a final response")

            try:
                return json.loads(final_text)
            except json.JSONDecodeError:
                debug_text = final_text.strip()
                logger.warning("Invalid JSON output from %s: %s", agent_name, debug_text)
                return {"error": f"Invalid JSON output from {agent_name}: {debug_text}"}

        except Exception as e:
            logger.exception("Pipeline agent %s failed", agent_name)
            return {"error": str(e)}

    def _output_failed(self, output: Dict[str, Any]) -> bool:
        return isinstance(output, dict) and ("error" in output or output.get("output_text") is not None)

    async def _tool_only_fallback(
        self,
        input_data: DocumentInput,
        failed_stage: str,
        error_context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Fallback to deterministic tool execution when an LLM agent fails.
        """
        self.state["fallback"] = {
            "failed_stage": failed_stage,
            "error_context": error_context,
        }

        pdf_path = input_data.pdf_path
        pages = scan_pdf_pages(pdf_path)
        relevant_pages = identify_relevant_pages(pages)
        reduced_pdf_path = create_reduced_pdf(pdf_path, relevant_pages)

        reduced_output = ReducedDocumentOutput(
            relevant_pages=relevant_pages,
            reduced_pdf_path=reduced_pdf_path,
            confidence=0.90,
        )
        self.state["agent1_output"] = reduced_output

        tables = parse_reduced_pdf(reduced_pdf_path)
        company_name = extract_company_name(tables)
        financial_data = extract_table_data(tables)
        computed_ratios = compute_financial_ratios(financial_data, self.config.required_ratios)

        extracted_output = ExtractedDataOutput(
            company_name=company_name,
            financial_data=financial_data,
            computed_ratios=computed_ratios,
            extraction_confidence=0.85,
        )
        self.state["agent2_output"] = extracted_output

        analysis_trends = analyze_trends({"computed_ratios": computed_ratios}, [])
        analysis_output = AnalysisOutput(
            trends=analysis_trends,
            insights=generate_insights(analysis_trends, {"computed_ratios": computed_ratios}),
            recommendations=generate_recommendations(analysis_trends),
        )
        self.state["agent3_output"] = analysis_output

        return self.state
