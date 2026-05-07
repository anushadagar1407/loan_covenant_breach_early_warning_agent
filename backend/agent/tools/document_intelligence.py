"""
document_intelligence.py
========================
Tools for Agent 1: Document Intelligence Agent.
Handles PDF scanning, page identification, and reduced PDF creation.
"""

import fitz  # PyMuPDF
import os
import tempfile
from pathlib import Path
from typing import List, Tuple


def scan_pdf_pages(pdf_path: str) -> list[dict]:
    """
    Scans the full PDF and returns a list of page dictionaries.
    Each page dictionary is JSON-serializable and contains page number and text.
    """
    doc = fitz.open(pdf_path)
    pages = []
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text = page.get_text() or ""
        pages.append({"page": page_num + 1, "text": text})
    doc.close()
    return pages


def identify_relevant_pages(pages: list[dict], keywords: list[str] = None) -> list[int]:
    """
    Identifies relevant pages based on keywords related to financial data.
    Default keywords: financial tables, ratios, company info.
    """
    if keywords is None:
        keywords = ["debt", "equity", "ratio", "financial", "table", "company", "assets", "liabilities", "income", "statement"]
    
    relevant = []
    for page in pages:
        text = str(page.get("text", "")).lower()
        page_num = int(page.get("page", 0))
        if any(kw in text for kw in keywords):
            relevant.append(page_num)
    return relevant


def create_reduced_pdf(pdf_path: str, relevant_pages: List[int], output_path: str = None) -> str:
    """
    Creates a reduced PDF containing only the relevant pages.
    Returns the path to the reduced PDF.
    """
    if output_path is None:
        temp_dir = tempfile.gettempdir()
        output_path = os.path.join(temp_dir, f"reduced_{Path(pdf_path).name}")
    
    doc = fitz.open(pdf_path)
    new_doc = fitz.open()
    
    for page_num in sorted(set(relevant_pages)):
        if 1 <= page_num <= len(doc):
            new_doc.insert_pdf(doc, from_page=page_num-1, to_page=page_num-1)
    
    new_doc.save(output_path)
    new_doc.close()
    doc.close()
    return output_path