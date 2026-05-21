# Testing Guide: Loan Covenant Breach Early Warning Agent

## Overview
This guide walks through all the steps to test the new changes on the `feature_resolving_errors` branch with a real financial report (Apple Inc).

---

## What's New in This Branch?

### Key Changes:
1. **Smaller, More Efficient Model**: Switched from `llama3.1:8b` to `llama2:7b`
2. **Fallback Mechanism**: Added deterministic fallback when Ollama LLM agent fails (memory constraints, crashes)
3. **Multi-Agent Pipeline**: New three-stage agent pipeline:
   - **Agent 1**: Document Intelligence (page scanning, relevant page extraction)
   - **Agent 2**: Data Extraction & Calculation (financial metrics, ratio computation)
   - **Agent 3**: Analysis (trend analysis, insights, recommendations)
4. **New Tools**: 
   - `document_intelligence.py` - PDF scanning and page selection
   - `data_extraction.py` - Financial data extraction using Camelot
   - `analysis.py` - Financial trend analysis

---

## Step-by-Step Testing

### Step 1: Install Dependencies

```bash
cd /workspaces/loan_covenant_breach_early_warning_agent/backend
pip install -r requirements.txt
```

**Expected output**: All packages installed successfully. Key new packages:
- `PyMuPDF==1.24.9` (PDF processing)
- `camelot-py[cv]==0.10.1` (Table extraction)
- `pandas==2.2.2` (Data processing)
- `numpy==1.26.4` (Numerical operations)

---

### Step 2: Start Ollama

Open a dedicated terminal and run:

```bash
ollama serve
```

**Expected output**:
```
time=2026-05-06T17:22:27.574Z level=INFO source=routes.go:1897 msg="Waiting for application startup."
...
time=2026-05-06T17:22:27.769Z level=INFO msg="Listening on 127.0.0.1:11434"
```

In another terminal, pull the model (one-time, ~3.8 GB download):

```bash
ollama pull llama2:7b
```

Verify it works:

```bash
ollama run llama2:7b "What is EBITDA?"
# Type /bye to exit
```

---

### Step 3: Generate Synthetic PDFs (Optional Test Data)

```bash
cd /workspaces/loan_covenant_breach_early_warning_agent/backend
python scripts/generate_pdfs.py
```

**Output**: Creates 10 synthetic financial reports in `data/synthetic_pdfs/`:
- CORP-001_Q3_2024.pdf
- CORP-001_Q4_2024.pdf
- ... and 8 more

---

### Step 4: Start the Backend API Server

```bash
cd /workspaces/loan_covenant_breach_early_warning_agent/backend
uvicorn api.main:app --port 8000 --host 0.0.0.0
```

**Expected output**:
```
INFO:     Started server process [PID]
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

The database will be automatically created at `data/covenant_agent.db`.

---

### Step 5: Test with Real Financial Report

#### Option A: Use the Pre-made Apple Inc Report

A realistic Apple Inc Q4 2024 financial report has already been created at:
```
backend/data/Apple_Inc_Q4_2024.pdf
```

Contents include:
- Condensed Consolidated Balance Sheet (Sept 28, 2024 vs Sept 30, 2023)
- Financial Metrics & Ratios
- Income Statement
- Loan Covenants section

#### Option B: Create Your Own Report

```python
python3 << 'EOF'
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib import colors
from reportlab.lib.units import inch

pdf_path = "/path/to/your/financial_report.pdf"

# Create document
doc = SimpleDocTemplate(pdf_path, pagesize=letter)
story = []

styles = getSampleStyleSheet()

# Add your content (balance sheet, income statement, etc.)
story.append(Paragraph("Company Name Financial Report", styles['Heading1']))
# ... add tables with financial data

doc.build(story)
print(f"✓ Created: {pdf_path}")
EOF
```

---

### Step 6: Test the Multi-Agent Pipeline

#### Using cURL (HTTP API):

```bash
curl -X POST http://localhost:8000/api/multi-agent \
  -H "Content-Type: application/json" \
  -d '{
    "pdf_path": "/workspaces/loan_covenant_breach_early_warning_agent/backend/data/Apple_Inc_Q4_2024.pdf",
    "borrower_id": "AAPL"
  }' 2>&1 | python -m json.tool
```

**Response will include**:
```json
{
  "run_id": "uuid-string",
  "status": "started",
  "pdf_path": "/path/to/pdf"
}
```

The agent runs in the background. Check status with:

```bash
curl http://localhost:8000/api/runs/{run_id}
```

#### Using Python (Direct):

```python
import asyncio
import sys
sys.path.insert(0, '/workspaces/loan_covenant_breach_early_warning_agent/backend')

from agent.agent_runner import run_multi_agent_pipeline

async def test():
    result = await run_multi_agent_pipeline(
        pdf_path="/workspaces/loan_covenant_breach_early_warning_agent/backend/data/Apple_Inc_Q4_2024.pdf",
        borrower_id="AAPL",
        config={
            "required_ratios": ["debt_ratio", "equity_debt_ratio", "roe", "roa"]
        }
    )
    
    print(f"Status: {result['status']}")
    print(f"Run ID: {result['run_id']}")
    print(f"Tools executed: {len(result['tool_call_events'])}")
    print(f"Audit log events: {len(result['audit_log_entries'])}")
    
    return result

result = asyncio.run(test())
```

---

## Expected Results

### Successful Execution:

✓ **Pipeline Status**: `completed`  
✓ **Tool Events**: 3 tools executed in sequence:
   1. `document_intelligence_agent` - Scans PDF, identifies relevant pages
   2. `data_extraction_agent` - Extracts financial tables and computes ratios
   3. `analysis_agent` - Generates trends and recommendations

✓ **Audit Trail**: 8+ events logged, including:
   - `pipeline_start`
   - `tool_called` (for each agent)
   - `tool_completed` (with latency)
   - `pipeline_complete`

### Fallback Mechanism:

If Ollama fails (memory error, timeout), the system **automatically switches to deterministic tool execution**:
- Uses `PyMuPDF` for PDF parsing instead of LLM
- Uses `Camelot` for table extraction
- Uses heuristics for financial ratio computation
- Pipeline completes successfully with confidence scores

**Error message example**:
```
Error in document_intelligence: OllamaException - model requires more system memory (5.5 GiB) than available (4.6 GiB)
→ [AUTO] Switching to tool-only fallback...
✓ Pipeline completed successfully
```

---

## Test Scenarios

| Scenario | Command | Expected Outcome |
|----------|---------|------------------|
| **Apple Report** | See Step 6 | ✓ Complete with financial metrics extracted |
| **Synthetic CORP-001** | `pdf_path: "data/synthetic_pdfs/CORP-001_Q3_2024.pdf"` | ✓ Covenant breach analysis included |
| **Custom Report** | Your own PDF | ✓ Generic financial analysis |
| **Ollama Down** | Stop Ollama, run pipeline | ✓ Fallback to deterministic tools |

---

## Troubleshooting

### Problem: "address already in use"
```bash
# Kill existing process
pkill -f "uvicorn api.main"
# Restart
uvicorn api.main:app --port 8000
```

### Problem: "model requires more memory"
This is **expected and OK!** The new fallback mechanism handles this:
- LLM agent fails → System detects memory error
- Automatically switches to deterministic tools (PDF parsing + heuristics)
- Returns complete results anyway

See test output above for example.

### Problem: "camelot table extraction failed"
- Ensure PDF has proper table formatting
- Check PDF is not image-based (OCR not used)
- Fallback will still complete analysis with alternative heuristics

### Problem: Ollama not responding
```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Verify model loaded
ollama list
```

---

## Viewing Results  

### Via API:

```bash
# Get run details
curl http://localhost:8000/api/runs/{run_id}

# List all runs
curl http://localhost:8000/api/runs
```

### Via Database:

```bash
# View runs table
sqlite3 backend/data/covenant_agent.db \
  "SELECT run_id, status, scenario_id, borrower_id FROM agent_runs LIMIT 10;"

# View tool events
sqlite3 backend/data/covenant_agent.db \
  "SELECT tool_name, call_order, latency_ms FROM tool_call_events WHERE run_id = '{run_id}';"

# View audit log
sqlite3 backend/data/covenant_agent.db \
  "SELECT event_type, message FROM audit_log_entries WHERE run_id = '{run_id}' LIMIT 20;"
```

---

## Summary

✓ **New features tested**: Deterministic fallback, multi-agent pipeline, real financial report processing  
✓ **Model optimized**: Switched to llama2:7b for lower memory requirement  
✓ **Error handling**: Graceful degradation when LLM unavailable  
✓ **Audit trail**: Complete traceability of all agent actions  

**Next steps**:
- Use the frontend dashboard at http://localhost:3000 (requires `npm run dev` in `frontend/` folder)
- Test with different financial reports
- Monitor memory usage and performance metrics

---

## Questions?

Check the README.md for more details on the thesis hypotheses and system architecture.
