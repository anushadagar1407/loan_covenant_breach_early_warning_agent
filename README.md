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
- data-source provenance (`pdf_extraction`, `pdf_extraction_unverified`, or `ground_truth_fallback`)
- tool call trace
- audit trail
- clause coverage details
- per-tool accuracy breakdown
- evidence-quality flags
- research signal flags

## Current architecture

There are three run modes:

- `L1`: deterministic control workflow. This is the reproducible baseline.
- `L2`: LLM-driven workflow with strict tool constraints and deterministic fallback.
- `L3`: higher-autonomy LLM workflow with the same guardrails and fallback.

Scenarios are not loaded from hardcoded UI constants. They are built dynamically from the PDFs in `backend/data/synthetic_pdfs/` by `backend/agent/scenario_catalog.py`.

The scenario catalog supports both generated names such as
`CORP-001_2026_Q1_Financial_Report.pdf` and existing checked-in names such as
`CORP-001_Q3_2024.pdf`. PDFs without a matching borrower profile are excluded
from the runnable scenario list.

## Data source strategy

### Primary source in this repo

The primary source is the local PDF pipeline:

- input reports are stored in `backend/data/synthetic_pdfs/`
- scenario metadata is derived from the PDF filename and parsed PDF contents
- covenant and borrower policy data comes from `backend/data/borrower_profiles.json`
- extraction provenance is saved with every run so thesis analysis can separate clean PDF parses from unverified parser results or ground-truth fallback data

Ground-truth fallback is disabled by default for evaluation integrity. To use
canonical generated values for clearly labeled pilot recovery when PDF parsing is incomplete, set:

```bash
ALLOW_GROUND_TRUTH_FALLBACK=1
```

When fallback is enabled, runs are still tagged with `ground_truth_fallback_used`
so they can be excluded from academic evaluation cohorts.

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

### GitHub Codespaces prerequisite

New Codespaces install Ollama automatically from `.devcontainer/install-ollama.sh`
when the Codespace is created. If you created the Codespace before this file was
added, rebuild the Codespace container or run the manual install once:

```bash
sudo apt-get update
sudo apt-get install -y curl ca-certificates zstd
curl -fsSL https://ollama.com/install.sh | sh
```

Verify the install:

```bash
ollama --version
```

If `ollama serve` prints `bash: ollama: command not found`, Ollama is not yet
installed in that Codespace container.

## Setup

### 1. Start Ollama

Run in a dedicated terminal:

```bash
ollama serve
```

Optional model pull:

```bash
ollama pull llama3.1:8b
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
  -d '{"scenario_id":"CORP-001_Q3_2024","autonomy_level":1}'
```

Fetch the run:

```bash
curl http://localhost:8000/api/runs/<run_id>
```

List scenarios:

```bash
curl http://localhost:8000/api/scenarios
```

Submit a pilot trust-study response for H3/H4:

```bash
curl -X POST http://localhost:8000/api/trust/responses \
  -H "Content-Type: application/json" \
  -d '{
    "run_id":"<run_id>",
    "stakeholder_group":"risk_compliance",
    "transparency_condition":"transparent",
    "trust_score":6,
    "auditability_score":6,
    "reliability_score":5,
    "explanation_sufficiency_score":6
  }'
```

Fetch trust-study analysis:

```bash
curl http://localhost:8000/api/trust/analysis
```

For a presentation-only H3/H4 pilot, seed clearly labeled synthetic responses:

```bash
cd backend
python scripts/seed_synthetic_trust_pilot.py
```

These rows are stored with `response_source="synthetic_demo"`. They are useful
for showing the dashboard mechanics, but they are not real stakeholder survey
evidence and should remain separate from final thesis analysis.

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

`L2` and `L3` use the ADK/Ollama path by default. Set `USE_LLM_AGENT=0`
only when you need a deterministic reproducibility run without model calls.
If the local model is unavailable or exceeds `ADK_RUN_TIMEOUT_SECONDS`, the
run is marked as `adk_fallback` and the deterministic recovery path is recorded
in the audit log.

Guardrails:

- only registered tools are allowed
- ADK `before_tool_callback`, `after_tool_callback`, and `on_tool_error_callback`
  persist real tool-call traces for thesis metrics
- invalid tool calls are trapped
- if the model emits an invalid tool name, the run falls back to deterministic execution
- if model execution fails, the error is persisted and the deterministic fallback
  is labeled in the run record

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

- `backend/api/routes/trust_routes.py`
  Pilot trust-study response capture and H3/H4 directional analysis.

- `backend/metrics/registry.py`
  Aggregated H1/H2-facing summary metrics, evidence-quality warnings, and metric history.

### Frontend

- `frontend/app/page.tsx`
  Dashboard and run-launch modal.

- `frontend/app/runs/page.tsx`
  Run list.

- `frontend/app/runs/[id]/page.tsx`
  Trace view, metric breakdown, audit trail, PDF-derived inputs, and data-source provenance.

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
- `data_source`
- `ground_truth_fallback_used`
- `experiment_condition`
- `transparency_artifacts_present`
- `execution_mode`
- `adk_invocation_attempted`
- `deterministic_fallback_used`
- `tool_accuracy_details`
- `clause_coverage_details`
- `research_signals`

### Evidence-quality interpretation

The dashboard now distinguishes exploratory evidence from stronger evaluation
evidence. H1/H2 labels should be treated as exploratory until enough runs exist
and synthetic or fallback rows are excluded from the analysis cohort.

H3 and H4 are now instrumented but not automatically proven. They require
stored stakeholder trust responses under outcome-only and transparent
conditions. Until those responses exist, the registry reports H3/H4 as not yet
evaluated.

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
