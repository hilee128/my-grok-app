#!/usr/bin/env python3
"""Google Ads OAuth — refresh token 발급 스크립트.

사용법:
  1. Google Cloud Console 에서 OAuth 클라이언트 ID/Secret 발급
  2. .env 에 GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET 입력
  3. python3 scripts/google_ads_auth.py 실행
  4. 브라우저 로그인 후 출력된 GOOGLE_ADS_REFRESH_TOKEN 을 .env 에 저장
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

CLIENT_ID = os.getenv("GOOGLE_ADS_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("GOOGLE_ADS_CLIENT_SECRET", "")
SCOPE = "https://www.googleapis.com/auth/adwords"


def main() -> int:
    if not CLIENT_ID or not CLIENT_SECRET:
        print("GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET 을 .env 에 먼저 설정하세요.")
        return 1

    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError:
        print("pip3 install google-auth-oauthlib 실행 후 다시 시도하세요.")
        return 1

    client_config = {
        "installed": {
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost"],
        }
    }

    flow = InstalledAppFlow.from_client_config(client_config, scopes=[SCOPE])
    creds = flow.run_local_server(port=8080, prompt="consent")

    print("\n=== .env 에 아래 값을 추가하세요 ===\n")
    print(f"GOOGLE_ADS_REFRESH_TOKEN={creds.refresh_token}")
    print("GOOGLE_ADS_CUSTOMER_IDS=고객ID1,고객ID2")
    print("API_MODE=live")
    return 0


if __name__ == "__main__":
    sys.exit(main())