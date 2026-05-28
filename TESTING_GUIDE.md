# Testing Guide: Loan Covenant Breach Early Warning Agent

This guide validates the `feature_resolving_errors` branch as a thesis artifact for H1-H4: outcome/process gaps, autonomy-driven process errors, trust predictors, and transparency effects.

## 1. Environment

Backend:

```bash
cd backend
pip install -r requirements.txt
python scripts/generate_pdfs.py
```

Ollama:

```bash
ollama serve
ollama pull llama3.1:8b
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## 2. Backend Health

```bash
cd backend
uvicorn api.main:app --reload --port 8000
curl http://localhost:8000/health
curl http://localhost:8000/api/scenarios
```

Expected: the API starts, SQLite initializes, and scenarios are derived from PDFs in `backend/data/synthetic_pdfs/`.

## 3. H1/H2 Flow

Run one scenario at each autonomy level from the Dashboard, or use the API:

```bash
curl -X POST http://localhost:8000/api/runs \
  -H "Content-Type: application/json" \
  -d '{"scenario_id":"CORP-001_Q3_2024","autonomy_level":1}'
```

Repeat for autonomy levels `2` and `3`.

Expected:

- L1 records the deterministic six-step control workflow.
- L2/L3 attempt the ADK/Ollama path by default.
- If the configured Ollama model is unavailable or exceeds `ADK_RUN_TIMEOUT_SECONDS`, the run is marked with `execution_mode="adk_fallback"` and still stores deterministic fallback audit events.
- Run detail pages show tool trajectory, clause coverage, audit trail, data provenance, and H1 hidden-process-risk alerts when applicable.

## 4. H3/H4 Flow

Open `/trust`, choose a completed run, and record both:

- `Outcome only`
- `Transparent`

Use at least two stakeholder groups for a credible pilot. The `/trust` dashboard should update response counts, transparency delta, H3 readiness, and H4 readiness.

Synthetic pilot responses are available only for dashboard mechanics:

```bash
cd backend
python scripts/seed_synthetic_trust_pilot.py
```

Rows created by this script use `response_source="synthetic_demo"` and must be separated from real stakeholder evidence.

## 5. Build And Static Checks

```bash
cd backend
python -m compileall -q .

cd frontend
npm.cmd run build
```

Expected: Python compilation succeeds and the Next.js production build completes without external font downloads.

## 6. ADK Verification

```bash
cd backend
python -c "from agent.covenant_agent import create_covenant_agent; a=create_covenant_agent(2); print(a.name, len(a.tools), type(a.model).__name__)"
```

Expected: `risk_eval_l2 6 LiteLlm`.

Manual runtime verification:

1. Ensure `OLLAMA_MODEL` in `backend/.env` is installed locally.
2. Start backend and frontend.
3. Run an L2 or L3 scenario.
4. Open the run detail page.
5. Confirm the run shows either `adk ollama` or `adk fallback`, with audit trail and tool metrics persisted.
