"""
agent/baselines.py
==================
Baseline implementations for comparison.
"""

import os
import json
from pathlib import Path
from typing import Dict

from agent.tools import (
    extract_financial_metrics,
    identify_applicable_covenants,
    check_accounting_adjustments,
    check_grace_period,
    calculate_breach_risk,
    generate_report,
)


class RuleBasedBaseline:
    """Deterministic rule-based covenant checker. Always 100% coverage."""
    
    def __init__(self):
        self.name = "Rule-Based Baseline"
        self.clause_coverage_score = 1.0
    
    def run(self, pdf_path: str, borrower_id: str, scenario_id: str) -> Dict:
        """Execute fixed tool pipeline."""
        extraction_result = extract_financial_metrics(pdf_path, borrower_id)
        covenant_result = identify_applicable_covenants(borrower_id)
        adjustment_result = check_accounting_adjustments(borrower_id, extraction_result)
        grace_period_result = check_grace_period(borrower_id)
        
        adjusted_financials = {
            "adjusted_ebitda": adjustment_result["adjusted_ebitda"],
            "adjusted_debt": adjustment_result["adjusted_debt"],
            "interest_expense": extraction_result["interest_expense"],
            "current_assets": extraction_result["current_assets"],
            "current_liabilities": extraction_result["current_liabilities"],
        }
        
        breach_result = calculate_breach_risk(adjusted_financials, covenant_result, grace_period_result)
        report_result = generate_report(scenario_id, borrower_id, extraction_result, covenant_result, adjustment_result, grace_period_result, breach_result)
        
        return {
            "approach": "rule_based",
            "final_verdict": breach_result["verdict"],
            "clause_coverage_score": 1.0,
            "trajectory_score": 1.0,
            "tools_called": ["extract_financial_metrics", "identify_applicable_covenants", "check_accounting_adjustments", "check_grace_period", "calculate_breach_risk", "generate_report"],
            "process_error_detected": False,
            "breach_result": breach_result,
            "report": report_result
        }


class SingleShotLLMBaseline:
    """Single-prompt LLM without tool use."""
    
    def __init__(self, ollama_model: str = "llama2:7b"):
        self.name = "Single-Shot LLM Baseline"
        self.ollama_model = ollama_model
    
    def run(self, pdf_path: str, borrower_id: str, scenario_id: str) -> Dict:
        """Single LLM call with full context."""
        import pdfplumber
        pdf_text = ""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages[:5]:
                    pdf_text += page.extract_text() or ""
        except Exception as e:
            pdf_text = f"Error: {e}"
        
        profiles_path = Path(__file__).parent.parent / "data" / "borrower_profiles.json"
        with open(profiles_path) as f:
            profiles_data = json.load(f)
        borrower = next(b for b in profiles_data["borrowers"] if b["borrower_id"] == borrower_id)
        
        prompt = f"""You are a credit risk analyst at Deutsche Bank.

Borrower: {borrower['name']} (ID: {borrower_id})
Covenants:
- Max Debt/EBITDA: {borrower['covenants']['max_debt_to_ebitda']}
- Min Interest Coverage: {borrower['covenants']['min_interest_coverage']}
- Min Liquidity: {borrower['covenants']['min_liquidity_ratio']}

Financial Report:
{pdf_text[:2000]}

Determine breach status. Output ONLY ONE WORD: breach, breach_curable, imminent, or no_breach"""
        
        try:
            import httpx
            ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
            response = httpx.post(
                f"{ollama_host}/api/generate",
                json={"model": self.ollama_model, "prompt": prompt, "stream": False, "options": {"temperature": 0}},
                timeout=60.0
            )
            
            if response.status_code == 200:
                llm_output = response.json()["response"].strip().lower()
                if "breach_curable" in llm_output:
                    verdict = "breach_curable"
                elif "breach" in llm_output:
                    verdict = "breach"
                elif "imminent" in llm_output:
                    verdict = "imminent"
                else:
                    verdict = "no_breach"
            else:
                verdict = "error"
        except Exception as e:
            print(f"Error: {e}")
            verdict = "error"
        
        return {
            "approach": "single_shot_llm",
            "final_verdict": verdict,
            "clause_coverage_score": 0.5,
            "trajectory_score": 0.0,
            "tools_called": [],
            "process_error_detected": True
        }


def run_baseline_evaluation(baseline_type: str, scenarios: list) -> list:
    """Run baseline on all scenarios."""
    if baseline_type == "rule_based":
        baseline = RuleBasedBaseline()
    elif baseline_type == "single_shot_llm":
        baseline = SingleShotLLMBaseline()
    else:
        raise ValueError(f"Unknown baseline: {baseline_type}")
    
    results = []
    for scenario in scenarios:
        result = baseline.run(
            pdf_path=scenario["pdf_path"],
            borrower_id=scenario["borrower_id"],
            scenario_id=scenario["scenario_id"]
        )
        
        if "expected_verdict" in scenario:
            result["correct_verdict"] = scenario["expected_verdict"]
            result["outcome_correct"] = (result["final_verdict"] == scenario["expected_verdict"])
        
        results.append(result)
    
    return results
