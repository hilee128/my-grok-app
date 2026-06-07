from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

TEAM_ACCESS_PASSWORD = os.getenv("TEAM_ACCESS_PASSWORD", "")
SKIP_AUTH = os.getenv("SKIP_AUTH", "false").lower() == "true"
TOKEN_TTL_HOURS = int(os.getenv("TOKEN_TTL_HOURS", "72"))

_tokens: dict[str, datetime] = {}
_bearer = HTTPBearer(auto_error=False)


def login(password: str) -> Optional[str]:
    if not TEAM_ACCESS_PASSWORD:
        return None
    if password != TEAM_ACCESS_PASSWORD:
        return None
    token = secrets.token_urlsafe(32)
    _tokens[token] = datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS)
    return token


def verify_token(token: Optional[str]) -> bool:
    if SKIP_AUTH or not TEAM_ACCESS_PASSWORD:
        return True
    if not token:
        return False
    expires = _tokens.get(token)
    if not expires:
        return False
    if expires < datetime.now(timezone.utc):
        _tokens.pop(token, None)
        return False
    return True


def require_team_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> None:
    if SKIP_AUTH or not TEAM_ACCESS_PASSWORD:
        return
    token = credentials.credentials if credentials else None
    if not verify_token(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="팀 로그인이 필요합니다.",
        )