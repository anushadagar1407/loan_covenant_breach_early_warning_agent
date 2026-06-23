.PHONY: install install-backend install-frontend pdfs seed-pilot-runs seed-trust-pilot backend frontend dev clean

# Setup

install: install-backend install-frontend

install-backend:
	cd backend && pip install -r requirements.txt

install-frontend:
	cd frontend && npm install

# Data

pdfs:
	cd backend && python scripts/generate_pdfs.py

seed-pilot-runs:
	cd backend && python scripts/seed_demo_runs.py

seed-trust-pilot:
	cd backend && python scripts/seed_synthetic_trust_pilot.py

# Run

backend:
	cd backend && python -m uvicorn api.main:app --reload --port 8010

frontend:
	cd frontend && npm run dev

dev:
	@echo "Starting backend on :8010 and frontend on :3000"
	@echo "Run 'make backend' and 'make frontend' in separate terminals."

# Utility

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	rm -f backend/data/covenant_agent.db
	@echo "Cleaned."
