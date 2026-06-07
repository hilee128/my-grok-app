#!/usr/bin/env python3
"""3매체 데모 데이터를 JSON으로보냅니다 (GitHub Pages용)."""

import json
from pathlib import Path

from api.services.orchestrator import Orchestrator

rows = [c.to_row() for c in Orchestrator().fetch_all()]
out = Path("data/campaigns.json")
out.parent.mkdir(exist_ok=True)
out.write_text(
    json.dumps({"mode": "mock", "campaigns": rows}, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
print(f"Exported {len(rows)} campaigns -> {out}")