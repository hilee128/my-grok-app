from __future__ import annotations

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from api.config import platform_status
from api.services.orchestrator import Orchestrator

app = FastAPI(title="Ad Performance API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

orchestrator = Orchestrator()


@app.get("/api/health")
def health():
    return {"ok": True, **platform_status()}


@app.get("/api/campaigns")
def get_campaigns():
    campaigns = orchestrator.fetch_all()
    return {
        "campaigns": [c.to_row() for c in campaigns],
        "count": len(campaigns),
        **platform_status(),
    }


@app.post("/api/analyze")
def analyze(auto_pause: bool = Query(True)):
    result = orchestrator.analyze(auto_pause=auto_pause)
    return result.to_dict()


@app.post("/api/auto-pause")
def auto_pause():
    result = orchestrator.analyze(auto_pause=True)
    return {
        "paused_count": len(result.paused),
        "saved_spend": result.saved_spend,
        "paused": result.paused,
        "summary": result.summary,
    }