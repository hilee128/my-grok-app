from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from api.config import MOCK_MODE, platform_status
from api.connect import test_all_platforms
from api.services.orchestrator import Orchestrator

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Ad Performance API", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

orchestrator = Orchestrator()


class PauseRequest(BaseModel):
    platform: str
    campaign_id: str
    account_id: str | None = None


@app.get("/api/health")
def health():
    status = platform_status()
    return {
        "ok": True,
        "live_pause_enabled": (not MOCK_MODE)
        and any(status[k]["configured"] for k in ("meta", "youtube", "tiktok")),
        **status,
    }


@app.get("/api/connect/test")
def connect_test():
    return test_all_platforms()


@app.get("/api/campaigns")
def get_campaigns():
    try:
        campaigns, warnings = orchestrator.fetch_all()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "campaigns": [c.to_row() for c in campaigns],
        "count": len(campaigns),
        "warnings": warnings,
        **platform_status(),
    }


@app.post("/api/analyze")
def analyze(auto_pause: bool = Query(False)):
    return orchestrator.analyze(auto_pause=auto_pause).to_dict()


@app.post("/api/auto-pause")
def auto_pause():
    if MOCK_MODE:
        result = orchestrator.analyze(auto_pause=True)
        return {
            "mode": "simulation",
            "message": "데모 모드입니다. .env 에 API_MODE=live 설정 후 실제 중단됩니다.",
            "paused_count": len(result.paused),
            "saved_spend": result.saved_spend,
            "paused": result.paused,
            "summary": result.summary,
        }

    result = orchestrator.analyze(auto_pause=True)
    return {
        "mode": "live",
        "message": "실제 매체 API로 일시정지 요청을 보냈습니다.",
        "paused_count": len(result.paused),
        "saved_spend": result.saved_spend,
        "paused": result.paused,
        "summary": result.summary,
    }


@app.post("/api/pause")
def pause_campaign(body: PauseRequest):
    if MOCK_MODE:
        raise HTTPException(
            status_code=400,
            detail="실연동 모드가 아닙니다. .env 에 API_MODE=live 를 설정하세요.",
        )
    result = orchestrator.pause_one(body.platform, body.campaign_id, body.account_id)
    if not result.success:
        raise HTTPException(status_code=502, detail=result.message)
    return result.to_dict()