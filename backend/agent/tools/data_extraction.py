"""
data_extraction.py
==================
Tools for Agent 2: Data Extraction & Calculation Agent.
Handles parsing reduced PDFs, extracting table data, and computing financial ratios.
"""

import camelot
import pandas as pd
import re
from typing import Dict, List


def parse_reduced_pdf(pdf_path: str) -> list[dict]:
    """
    Parses the reduced PDF and extracts tables using Camelot.
    Returns a list of JSON-friendly table dictionaries.
    """
    try:
        tables = camelot.read_pdf(pdf_path, pages='all')
        parsed = []
        for table in tables:
            df = table.df
            cols = [str(c) for c in df.columns]
            rows = []
            for row in df.itertuples(index=False, name=None):
                rows.append({cols[i]: str(val) for i, val in enumerate(row)})
            parsed.append({
                "page": getattr(table, "page", None),
                "shape": [df.shape[0], df.shape[1]],
                "rows": rows,
            })
        return parsed
    except Exception as e:
        print(f"Error parsing PDF: {e}")
        return []


def extract_table_data(tables: list[dict]) -> Dict[str, float]:
    """
    Extracts key financial data from JSON-friendly tables.
    Looks for common financial metrics.
    """
    data = {}
    for table in tables:
        rows = table.get("rows", [])
        for row in rows:
            for col, val in row.items():
                col_str = str(col).lower()
                if 'debt' in col_str and 'total' in col_str and 'total_debt' not in data:
                    data['total_debt'] = _extract_numeric([val])
                elif 'equity' in col_str and 'total_equity' not in data:
                    data['total_equity'] = _extract_numeric([val])
                elif 'assets' in col_str and 'total' in col_str and 'total_assets' not in data:
                    data['total_assets'] = _extract_numeric([val])
                elif 'liabilities' in col_str and 'total' in col_str and 'total_liabilities' not in data:
                    data['total_liabilities'] = _extract_numeric([val])
                elif 'ebitda' in col_str and 'ebitda' not in data:
                    data['ebitda'] = _extract_numeric([val])
                elif 'net income' in col_str and 'net_income' not in data:
                    data['net_income'] = _extract_numeric([val])
    return data


def _extract_numeric(series) -> float:
    """Helper to extract numeric value from a pandas Series."""
    for val in series:
        val_str = str(val).replace(',', '').replace('$', '')
        match = re.search(r'[\d.]+', val_str)
        if match:
            try:
                return float(match.group())
            except ValueError:
                continue
    return 0.0


def compute_financial_ratios(financial_data: Dict[str, float], required_ratios: List[str]) -> Dict[str, float]:
    """
    Computes specified financial ratios from extracted data.
    """
    ratios = {}
    td = financial_data.get('total_debt', 0)
    te = financial_data.get('total_equity', 0)
    ta = financial_data.get('total_assets', 0)
    tl = financial_data.get('total_liabilities', 0)
    ebitda = financial_data.get('ebitda', 0)
    ni = financial_data.get('net_income', 0)
    
    if 'debt_ratio' in required_ratios and ta > 0:
        ratios['debt_ratio'] = td / ta
    if 'equity_debt_ratio' in required_ratios and te > 0:
        ratios['equity_debt_ratio'] = td / te
    if 'roe' in required_ratios and te > 0:
        ratios['roe'] = ni / te
    if 'roa' in required_ratios and ta > 0:
        ratios['roa'] = ni / ta
    # Add more ratios as needed
    return ratios


def extract_company_name(tables: list[dict]) -> str:
    """
    Extracts company name from tables (simple heuristic).
    """
    for table in tables:
        for row in table.get("rows", []):
            for val in row.values():
                val_str = str(val)
                if 'company' in val_str.lower() or 'ltd' in val_str.lower() or 'inc' in val_str.lower():
                    return val_str
    return "Unknown"