# Loan Covenant Breach Early Warning Agent
### Deutsche Bank Thesis Project — Google ADK + FastAPI + Next.js

A production-grade agentic AI system demonstrating that **outcome-based metrics are insufficient for evaluating agentic workflows**. Built to support a Master's thesis on evaluating autonomy and trust in enterprise AI systems.

---

## Thesis Hypotheses (What This System Proves)

| Hypothesis | Claim | Demonstrated By |
|---|---|---|
| **H1** | Outcome metrics mask process-level errors | Gap Score = Process Error Rate − Outcome Error Rate > 0 |
| **H2** | Higher autonomy → more process errors | Process error rate: L1=0% → L2=30% → L3=40% |
| **H4** | Transparency mechanisms increase trust | Agent Registry dashboard surfaces invisible errors |

---

## The Core Demo (H1 in 30 Seconds)

**SCEN-001**: Meridian Industrial GmbH files a Q3 report. Their covenant allows an EBITDA add-back for restructuring charges.

| Run | Agent Type | Adjustment Checked? | Verdict | Outcome Correct? | Process Error? |
|---|---|---|---|---|---|
| Level 1 | Constrained | ✓ Yes | no_breach | ✓ Yes | ✗ No |
| Level 3 | Autonomous | ✗ Skipped | breach_curable | ✗ **Wrong** | ✓ **Yes** |

The Level-3 agent skipped one step and gave the wrong answer. Without the Agent Registry, this error is completely invisible to any outcome-only metric.

---

## Prerequisites

| Tool | Install | Verify |
|---|---|---|
| Python 3.11+ | [python.org](https://python.org) | `python3 --version` |
| Node.js 18+ | [nodejs.org](https://nodejs.org) | `node --version` |
| Ollama | [ollama.ai](https://ollama.ai) | `ollama --version` |

---

## Setup (5 Steps)

### Step 1 — Start Ollama

```bash
# In a dedicated terminal — leave it running
ollama serve

# In another terminal, pull the model (~5GB, one-time download)
ollama pull llama3.1:8b

# Verify
ollama run llama3.1:8b "What is EBITDA?"
# Type /bye to exit
```

### Step 2 — Backend Setup

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Generate the 10 synthetic loan report PDFs
python scripts/generate_pdfs.py

# Seed the database with 30 demo runs (all scenarios × all autonomy levels)
python scripts/seed_demo_runs.py

# Start the API server
uvicorn api.main:app --reload --port 8000
```

### Step 3 — Frontend Setup

```bash
# In a new terminal
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** — the dashboard will load immediately with seeded data.

---

## Running Live Agent Demos (With Ollama)

The seeded data gives you the dashboard immediately. For live demos using the actual LLM:

```bash
# POST to run a live agent (Ollama must be running)
curl -X POST http://localhost:8000/api/runs \
  -H "Content-Type: application/json" \
  -d '{"scenario_id": "SCEN-001", "autonomy_level": 3}'

# The run ID is returned immediately; the agent runs in the background
# Check status:
curl http://localhost:8000/api/runs/<run_id>
```

Or use the **"Run Agent"** button on the dashboard.

---

## Thesis Demo Script

### Demo 1: H1 (Outcome Metrics Mask Process Risk)

1. Open the **Dashboard** — note the Gap Score (Process Error Rate > Outcome Error Rate)
2. Click **"Run Agent"** → Select `SCEN-001` → Autonomy Level `3`
3. Open the run detail page
4. Observe the **⚠️ PROCESS ERROR DETECTED** banner
5. The trajectory timeline shows `check_accounting_adjustments` as a gray (skipped) node
6. The clause coverage score = 0.83 even though the outcome was wrong

**Key screenshot**: The banner says "correct outcome but skipped required compliance steps."

### Demo 2: H2 (Autonomy Increases Process Errors)

1. Open the **Agent Registry** page
2. The H2 Evidence table shows: Level 1 = 0 process errors, Level 2 = 3, Level 3 = 4
3. Average clause coverage declines: 1.18 → 1.09 → 1.05

### Demo 3: H4 (Transparency Drives Trust)

1. Without the registry: show a stakeholder the verdict (`no_breach`) — they trust the system
2. With the registry: show them the same run's audit trail, the skipped step, the coverage gap
3. The registry **is** the transparency mechanism — its existence is the H4 demonstration

---

## Project Structure

```
covenant-breach-agent/
├── backend/
│   ├── agent/
│   │   ├── covenant_agent.py         # ADK Agent definition (3 autonomy levels)
│   │   ├── agent_runner.py           # Metrics instrumentation + run execution
│   │   └── tools/
│   │       ├── pdf_extractor.py      # Tool 1: Extract financials from PDF
│   │       ├── covenant_identifier.py # Tool 2: Load covenant thresholds
│   │       ├── adjustment_checker.py  # Tool 3: ← THE H1 CRITICAL STEP
│   │       ├── grace_period_checker.py # Tool 4: Check cure provisions
│   │       ├── breach_calculator.py  # Tool 5: Compute ratios + verdict
│   │       └── report_generator.py   # Tool 6: Final structured report
│   ├── metrics/
│   │   ├── trajectory_tracker.py     # Metric 1: Did agent follow correct path?
│   │   ├── tool_accuracy_scorer.py   # Metric 2: Were tool calls valid?
│   │   ├── clause_coverage_scorer.py # Metric 3: ← Core H1 metric
│   │   └── registry.py              # Aggregated registry stats
│   ├── data/
│   │   ├── borrower_profiles.json    # 5 borrowers with covenant terms
│   │   ├── ground_truth.json         # 10 test scenarios with correct verdicts
│   │   └── synthetic_pdfs/           # Generated PDF reports
│   ├── api/
│   │   ├── main.py                   # FastAPI app
│   │   └── routes/
│   │       ├── agent_routes.py       # Run management endpoints
│   │       └── registry_routes.py   # Registry/metrics endpoints
│   └── scripts/
│       ├── generate_pdfs.py          # Generate synthetic PDFs
│       └── seed_demo_runs.py         # Seed DB with demo runs
└── frontend/
    ├── app/
    │   ├── page.tsx                  # Dashboard (Gap Score, H1/H2 charts)
    │   ├── runs/[id]/page.tsx        # Run detail + audit trail + trajectory
    │   └── registry/page.tsx         # Agent Registry (H4 mechanism)
    └── components/                   # Metric cards, trajectory viewer, etc.
```

---

## Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | System status (Ollama, DB) |
| GET | `/api/scenarios` | All 10 test scenarios |
| POST | `/api/runs` | Trigger a new agent run |
| GET | `/api/runs` | List all runs (paginated) |
| GET | `/api/runs/{id}` | Full run detail + audit trail |
| GET | `/api/registry/summary` | Aggregated metrics + Gap Score |
| GET | `/api/registry/h1-evidence` | Runs where outcome=correct + process_error=true |
| GET | `/api/registry/h2-evidence` | Process error rates by autonomy level |

---

## The 5 Thesis Metrics

| Metric | Formula | Thesis Link |
|---|---|---|
| **Trajectory Accuracy** | `tools_in_correct_order / total_expected` | H1, H2 |
| **Tool Call Accuracy** | `mean(accuracy_score per tool call)` | H1 |
| **Clause Coverage** | `clauses_checked / clauses_required` | H1, H3, H4 |
| **Step Latency Profile** | `latency_ms per tool call` | H2 |
| **Process vs Outcome Gap** | `process_error_rate − outcome_error_rate` | H1, H2, H3 |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Agent Framework | Google ADK 1.31+ |
| LLM | Ollama (llama3.1:8b) via LiteLLM |
| Backend API | FastAPI + Uvicorn |
| Database | SQLite via SQLAlchemy async |
| PDF Generation | reportlab |
| PDF Extraction | pdfplumber |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |

---

*Thesis: "Evaluating Autonomy and Trust in Agentic AI Systems: Metrics, Transparency, and Accountability Across Enterprise Financial Workflows"*
