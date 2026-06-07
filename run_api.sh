#!/bin/bash
cd "$(dirname "$0")"
export PORT="${PORT:-8000}"
python3 -m uvicorn api.main:app --reload --host 0.0.0.0 --port "$PORT"