# Loan Covenant Breach Early Warning Agent

Research-grade full-stack prototype for evaluating autonomy, process reliability, and transparency in covenant-monitoring workflows.

## What this system is for

This project is designed to support four research claims:

1. `H1`: outcome metrics can hide process failures.
2. `H2`: higher autonomy can increase hidden process risk.
3. `H3`: raw success metrics alone do not explain trust.
4. `H4`: transparency artifacts improve explainability and trust.

The system therefore does not stop at a final verdict. Each run stores:

- PDF-derived financial inputs
- tool call trace
- audit trail
- clause coverage details
- per-tool accuracy breakdown
- research signal flags

## Current architecture

There are three run modes:

- `L1`: deterministic control workflow. This is the reproducible baseline.
- `L2`: LLM-driven workflow with strict tool constraints and deterministic fallback.
- `L3`: higher-autonomy LLM workflow with the same guardrails and fallback.

Scenarios are not loaded from hardcoded UI constants. They are built dynamically from the PDFs in `backend/data/synthetic_pdfs/` by `backend/agent/scenario_catalog.py`.

## Data source strategy

### Primary source in this repo

The primary source is the local PDF pipeline:

- input reports are stored in `backend/data/synthetic_pdfs/`
- scenario metadata is derived from the PDF filename and parsed PDF contents
- covenant and borrower policy data comes from `backend/data/borrower_profiles.json`

### Why not live web extraction by default

Live web extraction for listed companies would require:

- stable external API/source selection
- symbol-to-company mapping
- filing normalization
- rate-limit and availability handling
- approval for internet access in production execution

That can be added later, but for thesis validity the current PDF-based ingestion is the more reproducible choice. It keeps each experiment controlled, replayable, and auditable.

## Prerequisites

- Python `3.12`
- Node.js `18+`
- Ollama installed locally

## Setup

### 1. Start Ollama

Run in a dedicated terminal:

```bash
ollama serve
```

Optional model pull:

```bash
ollama pull llama3.2:3b
```

### 2. Backend setup

```bash
cd backend
pip install -r requirements.txt
python scripts/generate_pdfs.py
uvicorn api.main:app --reload --port 8000
```

The backend initializes SQLite automatically on startup.

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Running the system

### UI path

1. Open the dashboard.
2. Click `Run Agent`.
3. Select a scenario generated from the PDF catalog.
4. Select `L1`, `L2`, or `L3`.
5. Wait for completion.
6. Open the run detail page for trace, inputs, and metric breakdown.

### API path

Start a run:

```bash
curl -X POST http://localhost:8000/api/runs \
  -H "Content-Type: application/json" \
  -d '{"scenario_id":"CORP-001_2024_Q1_Financial_Report","autonomy_level":1}'
```

Fetch the run:

```bash
curl http://localhost:8000/api/runs/<run_id>
```

List scenarios:

```bash
curl http://localhost:8000/api/scenarios
```

## Agent execution flow

### L1

`L1` is deterministic by design.

It executes the six-step covenant workflow in code:

1. `extract_financial_metrics`
2. `identify_applicable_covenants`
3. `check_accounting_adjustments`
4. `check_grace_period`
5. `calculate_breach_risk`
6. `generate_report`

This mode is the control condition for reproducibility.

### L2 / L3

`L2` and `L3` use the ADK/Ollama path.

Guardrails:

- only registered tools are allowed
- invalid tool calls are trapped
- if the model emits an invalid tool name, the run falls back to deterministic execution
- if model execution fails, the error is persisted and exposed in the run record

## Important files

### Backend

- `backend/agent/scenario_catalog.py`
  Builds PDF-derived scenarios dynamically.

- `backend/agent/agent_runner.py`
  Core runner for L1/L2/L3, metrics, trace persistence, and research signal generation.

- `backend/agent/covenant_agent.py`
  ADK agent configuration and autonomy-level instruction sets.

- `backend/api/routes/agent_routes.py`
  Run creation, run detail retrieval, scenario list endpoints.

- `backend/metrics/registry.py`
  Aggregated H1/H2-facing summary metrics for dashboards.

### Frontend

- `frontend/app/page.tsx`
  Dashboard and run-launch modal.

- `frontend/app/runs/page.tsx`
  Run list.

- `frontend/app/runs/[id]/page.tsx`
  Trace view, metric breakdown, audit trail, and PDF-derived inputs.

## Experimental interpretation

### How to read L1

`L1` is the control baseline. It should be:

- reproducible
- fully traced
- high coverage
- low hidden process risk

### How to read L2 and L3

`L2` and `L3` are the autonomy conditions. They are expected to show:

- more process variation
- occasional invalid tool attempts or fallbacks
- lower clause coverage or trajectory quality than `L1`
- more evidence relevant to `H1` and `H2`

### Research-grade output fields

Each run should support your thesis analysis through:

- `tool_call_events`
- `audit_log_entries`
- `scenario_inputs`
- `pdfScenario`
- `tool_accuracy_details`
- `clause_coverage_details`
- `research_signals`

## Troubleshooting

### Problem: run spinner never stops

Check:

```bash
curl http://localhost:8000/api/runs/<run_id>
```

If the backend returns `500`, inspect the backend terminal log. The frontend now stops polling on server errors and surfaces the message.

### Problem: Ollama runs but L2/L3 fail

Check the Ollama server:

```bash
curl http://localhost:11434/api/tags
```

If that fails, restart Ollama:

```bash
ollama serve
```

### Problem: PDF parse fails

Make sure the synthetic reports exist:

```bash
ls backend/data/synthetic_pdfs
```

If the folder is empty or stale, regenerate:

```bash
cd backend
python scripts/generate_pdfs.py
```

### Problem: backend imports or route changes not reflected

Restart the backend after structural changes:

```bash
cd backend
uvicorn api.main:app --reload --port 8000
```

### Problem: frontend stale state

Restart the frontend:

```bash
cd frontend
npm run dev
```

## Notes on web-based company ingestion

If you later want live listed-company ingestion, the recommended next step is:

1. use a filing API or official IR source
2. download the filing PDF or structured statement
3. normalize into the same `scenario_catalog` contract
4. preserve the exact source URL in the run payload for auditability

That keeps the research model intact while extending the ingestion source.
