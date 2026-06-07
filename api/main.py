from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from api.auth import TEAM_ACCESS_PASSWORD, login, require_team_auth
from api.config import MOCK_MODE, platform_status
from api.connect import test_all_platforms
from api.scheduler import run_scheduled_pause
from api.services.orchestrator import Orchestrator

logging.basicConfig(level=logging.INFO)
ROOT = Path(__file__).resolve().parent.parent


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(run_scheduled_pause())
    yield
    task.cancel()


app = FastAPI(title="Ad Performance API", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

orchestrator = Orchestrator()


class LoginRequest(BaseModel):
    password: str


class PauseRequest(BaseModel):
    platform: str
    campaign_id: str
    account_id: Optional[str] = None


@app.get("/api/auth/required")
def auth_required():
    return {"required": bool(TEAM_ACCESS_PASSWORD)}


@app.post("/api/auth/login")
def auth_login(body: LoginRequest):
    if not TEAM_ACCESS_PASSWORD:
        return {"token": "dev", "message": "인증 비활성화 (SKIP_AUTH 또는 비밀번호 미설정)"}
    token = login(body.password)
    if not token:
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")
    return {"token": token, "message": "로그인 성공"}


@app.get("/api/health")
def health():
    status = platform_status()
    return {
        "ok": True,
        "auth_required": bool(TEAM_ACCESS_PASSWORD),
        "live_pause_enabled": (not MOCK_MODE)
        and any(status[k]["configured"] for k in ("meta", "youtube", "tiktok")),
        **status,
    }


@app.get("/api/connect/test")
def connect_test(_: None = Depends(require_team_auth)):
    return test_all_platforms()


@app.get("/api/campaigns")
def get_campaigns(_: None = Depends(require_team_auth)):
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
def analyze(auto_pause: bool = Query(False), _: None = Depends(require_team_auth)):
    return orchestrator.analyze(auto_pause=auto_pause).to_dict()


@app.post("/api/auto-pause")
def auto_pause(_: None = Depends(require_team_auth)):
    if MOCK_MODE:
        result = orchestrator.analyze(auto_pause=True)
        return {
            "mode": "simulation",
            "message": "데모 모드입니다. API_MODE=live 설정 후 실제 중단됩니다.",
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
def pause_campaign(body: PauseRequest, _: None = Depends(require_team_auth)):
    if MOCK_MODE:
        raise HTTPException(status_code=400, detail="API_MODE=live 로 설정하세요.")
    result = orchestrator.pause_one(body.platform, body.campaign_id, body.account_id)
    if not result.success:
        raise HTTPException(status_code=502, detail=result.message)
    return result.to_dict()


@app.get("/")
def index():
    return FileResponse(ROOT / "ads.html")


app.mount("/", StaticFiles(directory=ROOT, html=True), name="static")