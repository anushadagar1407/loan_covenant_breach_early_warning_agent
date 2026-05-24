#!/usr/bin/env bash
set -euo pipefail

if command -v ollama >/dev/null 2>&1; then
  echo "Ollama is already installed."
  ollama --version || true
  exit 0
fi

echo "Installing Ollama for this dev container..."
curl -fsSL https://ollama.com/install.sh | sh

echo "Ollama installed. Start it with: ollama serve"
