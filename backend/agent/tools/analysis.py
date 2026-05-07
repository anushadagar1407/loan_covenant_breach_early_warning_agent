"""
analysis.py
===========
Tools for Agent 3: Analysis Agent.
Handles trend analysis, trajectory tracking, and insight generation.
"""

from typing import Dict, List
import numpy as np


def analyze_trends(extracted_data: Dict[str, float], historical_data: List[Dict[str, float]] = None) -> List[Dict[str, str]]:
    """
    Analyzes trends in financial ratios.
    If historical_data is provided, compares current to past.
    """
    trends = []
    current_ratios = extracted_data.get('computed_ratios', {})
    
    for ratio, value in current_ratios.items():
        trend = "stable"
        insight = f"{ratio} is at {value:.2f}"
        
        if historical_data:
            past_values = [h.get(ratio, 0) for h in historical_data]
            if past_values:
                avg_past = np.mean(past_values)
                if value > avg_past * 1.1:
                    trend = "increasing"
                    insight += f", up from average {avg_past:.2f}"
                elif value < avg_past * 0.9:
                    trend = "decreasing"
                    insight += f", down from average {avg_past:.2f}"
        
        trends.append({"ratio": ratio, "trend": trend, "insight": insight})
    
    return trends


def generate_insights(trends: List[Dict[str, str]], financial_data: Dict[str, float]) -> str:
    """
    Generates a human-readable insights summary.
    """
    insights = "Financial Analysis Insights:\n"
    for trend in trends:
        insights += f"- {trend['insight']}\n"
    
    # Add general insights
    debt_ratio = financial_data.get('computed_ratios', {}).get('debt_ratio', 0)
    if debt_ratio > 0.5:
        insights += "- High debt ratio indicates potential liquidity risk.\n"
    
    return insights


def generate_recommendations(trends: List[Dict[str, str]]) -> List[str]:
    """
    Generates recommendations based on trends.
    """
    recommendations = []
    for trend in trends:
        if trend['trend'] == 'increasing' and 'debt' in trend['ratio']:
            recommendations.append("Monitor debt levels closely to avoid covenant breaches.")
        elif trend['trend'] == 'decreasing' and 'equity' in trend['ratio']:
            recommendations.append("Consider equity financing to improve balance sheet.")
    
    if not recommendations:
        recommendations.append("Financial position appears stable; continue monitoring.")
    
    return recommendations