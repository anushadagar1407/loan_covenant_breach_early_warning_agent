.PHONY: install install-backend install-frontend pdfs backend frontend dev clean

# ── Setup ─────────────────────────────────────────────────────────────────────

install: install-backend install-frontend

install-backend:
	cd backend && pip install -r requirements.txt

install-frontend:
	cd frontend && npm install

# ── Data ──────────────────────────────────────────────────────────────────────

pdfs:
	cd backend && python scripts/generate_pdfs.py

# ── Run ───────────────────────────────────────────────────────────────────────

backend:
	cd backend && uvicorn api.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

# Run both in parallel (requires two terminals, or use GNU parallel / tmux)
dev:
	@echo "Starting backend on :8000 and frontend on :3000"
	@echo "Run 'make backend' and 'make frontend' in separate terminals."

# ── Utility ───────────────────────────────────────────────────────────────────

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	rm -f backend/covenant_breach.db
	@echo "Cleaned."
